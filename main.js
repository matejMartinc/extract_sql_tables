var app = angular.module('app', ['ngRoute']);

app.service('DataSort', function($http){

    var reservedwordsfrom = [" where ",
                   " group by ",
                   " having ",
                   " order by ",
                   " limit ",
                   " procedure ",
                   " into ",
                   " for update ",
                   " lock in "];

    var reservedwordsjoin = [" on ", " using "];
    this.queryTables = [];
    var me = this;

    //extract subqueries, returns a list of all queries
    var getSubqueries = function(query) {

        var subquery = "";
        var queryArray = [];

        //match all text in the parenthesis, add it to array and replace it with 'subconsulta' 
        //nested subqueries are also found.
        while(subquery != null) {
            subquery = query.match(/\([^()]*\)/g);
            
            for(var i in subquery) {
                queryArray.push(subquery[i].substring(1,subquery[i].length - 1));
                query = query.replace(subquery[i], 'subconsulta');     
            }        
        }

        //add main query without subqueries to the list and return the list
        queryArray.push(query);
        return queryArray;    
    }

    //main function for table extraction
    this.extractTables = function(query) {

        this.queryTables = [];
      
        //get a list of all subqueries and main query without subqueries
        var queryArray = getSubqueries(query);

        for(var i in queryArray) {
            query = queryArray[i];

            //change text to lowercase, remove line breaks and unnecessary white space
            query = query.toLowerCase();
            query = query.replace(/\n/g, ' ');
            query = query.replace(/ +/g, ' ');
            query = query.replace(/ +,/g, ',');

            //substitute left right outer cross, natural joins with "join".
            query = query.replace(/ (left|right) (outer )*join /g, ' join ');
            query = query.replace(/( inner| cross)* join/g, ' join');
            query = query.replace(/natural (((left|right)( outer)*) |inner )*join /g, ' join ');

            //find tables in cleaned query
            tableExpression(query);
        }
    }

    var tableExpression = function(sqlselect) {

        //extract text between 'from' and sql reserved words in 'reservedwordsfrom' list
        var leftBorder = " from ";
        var rightBorder = reservedwordsfrom.join("|");
        var list1 = extractInside(sqlselect, "(" + leftBorder + ")", "(" + rightBorder + ")")

        //check if query ends with table name
        var list2 = extractInside(sqlselect, "(" + leftBorder + ")", "($)");

        //if query ends with table name, extract all text after 'from' (list2).
        if(list1 == undefined) {
            if(list2 == undefined) {
                return;
            } 
            var string = list2[0]; 
        }
        else {
            var string = list1[0];
        }
        
        //find all text between joins and extract it
        var listOfTables = extractInside(string, "(^| join )", "(?= join |$)");
        var rightBorder = reservedwordsjoin.join("|");
        var leftBorder = "^";

        //go through a list of extracted text
        for(var i in listOfTables) {

            //find text after 'on' and 'using' and remove it
            var table = extractInside(listOfTables[i], "(" + leftBorder + ")", "(" + rightBorder + "|$)");

            //check for tables seperated by comma and split the text on commas
            var tableBundle = table[0].split(",");

            //remove aliases and remove 'subconsulata'
            for(var j in tableBundle) {
                var aliases = tableBundle[j].trim().split(" ");
                if(aliases[0].trim() != "subconsulta" && me.queryTables.indexOf(aliases[0].trim()) == -1) {
                    me.queryTables.push(aliases[0].trim());  
                }  
            }   
        }   
    }

    //helper function for extraction of text between defined left and right border
    var extractInside = function(string, leftBorder, rightBorder) {
        var innerText = [];

        //build a regular expression
        var pattern = leftBorder + "(.*?)" + rightBorder;
        var re = new RegExp(pattern,"g");
        
        //find all matches and push text between borders in a list
        var match = re.exec(string);
        if(match != null) innerText.push(match[2]);
        while(match != null){
            match = re.exec(string);
            if(match != null) innerText.push(match[2]);
        }
        if (innerText.length != 0) return innerText;
    }

    var CSVToArray = function( strData, strDelimiter ){
        // Check to see if the delimiter is defined. If not,
        // then default to comma.
        strDelimiter = (strDelimiter || ",");

        // Create a regular expression to parse the CSV values.
        var objPattern = new RegExp(
            (
                // Delimiters.
                "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +

                // Quoted fields.
                "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

                // Standard fields.
                "([^\"\\" + strDelimiter + "\\r\\n]*))"
            ),
            "gi"
            );

        var arrData = [[]];
        var arrMatches = null;
        while (arrMatches = objPattern.exec( strData )){

            // Get the delimiter that was found.
            var strMatchedDelimiter = arrMatches[ 1 ];

            if (strMatchedDelimiter.length && strMatchedDelimiter !== strDelimiter){
                arrData.push( [] );
            }

            var strMatchedValue;

            //check to see which kind of value we
            // captured (quoted or unquoted).
            if (arrMatches[ 2 ]){

                // We found a quoted value. 
                strMatchedValue = arrMatches[ 2 ].replace(
                    new RegExp( "\"\"", "g" ),
                    "\""
                    );

            } else {

                // We found a non-quoted value.
                strMatchedValue = arrMatches[ 3 ];
            }

            arrData[ arrData.length - 1 ].push( strMatchedValue );
        }

        // Return the parsed data.
        return( arrData );
    }

    this.idGenerator = function() {
        var S4 = function() {
           return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        };
        return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
    }

    this.getData = function(callback) {
        $http.get("./data/dependencias.csv")
            .then(function(response1) {
                $http.get("./data/actualizaciones.csv")
                .then(function(response2) {
                    
                    var tables = {};
                    var dependencyArray = CSVToArray(response1.data, ';');
                    var tableArray = CSVToArray(response2.data, ';');
                    
                    for(var i in tableArray) {
                        if(i != 0 && tableArray[i].length == 3) {
                            var name = tableArray[i][0] + "." + tableArray[i][1];
                            var updateTime = tableArray[i][2];
                            var dayandhour= updateTime.split(" ");
                            var day = dayandhour[0].split("/");
                            updateTime = new Date(day[2] + "/" + day[1] + "/" + day[0] + " " + dayandhour[1]);
                            if (tables.hasOwnProperty(name)) {
                                tables[name][0].push(updateTime);
                            }
                            else {
                                tables[name] = [[],[]];
                                tables[name][0].push(updateTime);
                            }
                        }
                    }

                    for(var i in dependencyArray) {
                        if(i != 0 && dependencyArray[i].length == 4) {
                            var name = dependencyArray[i][0] + "." + dependencyArray[i][1];
                            var dependencyName = dependencyArray[i][2] + "." + dependencyArray[i][3];
                            tables[name][1].push(dependencyName);  
                        }
                    }
                    callback(tables);  
                });
            });
    }

    this.tables = [];

    this.sortData = function(data, tables, parent) {
        for (var property in data) {
            if (data.hasOwnProperty(property)) {
                var updates = data[property][0].sort(function(a,b){
                    return b.getTime() - a.getTime();
                });
                var id = this.idGenerator();
                var day = updates[0].getDate();
                var month = updates[0].getMonth();
                var year = updates[0].getFullYear();
                var hours = updates[0].getHours();
                var minutes = updates[0].getMinutes();
                minutes = minutes < 10 ? '0' + minutes : minutes;
                hours = hours < 10 ? '0' + hours : hours;

                var dependencies = data[property][1];
                var newData = {};
                var newTables = [];
                if(dependencies.length != 0) {
                    for(var i in dependencies) {
                        if (data.hasOwnProperty(dependencies[i])) {
                            newData[dependencies[i]] = data[dependencies[i]];
                            newTables = [];
                            this.sortData(newData, newTables, id)
                        }    
                    }
                }

                if(newTables.length > 0)
                    property = "+ " + property;
                else
                    property = "- " + property;

                var table = {
                    "id" : id,
                    "parent" : parent,
                    "name" : property,
                    "updateTime" : day + "/" + (month + 1) + "/" + year + " " + hours + ":" + minutes, 
                    "updateTimeInMilies" : updates[0].getTime(),
                    "dependencies" : newTables,
                    "updateTimes" : updates
                }
                tables.push(table);   
            }            
        }
    }

    this.filterData = function(data) {
        var filteredTables = [];
        for(var i in data) {
            
            if(data[i].dependencies.length != 0) {
                filteredTables.push(data[i]);
            }
        }
        return filteredTables;
    }

    this.changeDate = function(data, date) {
        
        angular.forEach(data, function(item){

            for(var i in item.updateTimes) {
                console.log(item);
                if(item.dependencies.length > 0) {
                    this.changeDate(item.dependencies, date);
                }
                var update = item.updateTimes[i];
                if(update.getTime() <= date.getTime()) {
                    var day = update.getDate();
                    var month = update.getMonth();
                    var year = update.getFullYear();
                    var hours = update.getHours();
                    var minutes = update.getMinutes();
                    minutes = minutes < 10 ? '0' + minutes : minutes;
                    hours = hours < 10 ? '0' + hours : hours;
                    item.updateTime = day + "/" + (month + 1) + "/" + year + " " + hours + ":" + minutes, 
                    item.updateTimeInMilies = update.getTime()
                    break;
                }
                else if (update.getTime() > date.getTime() && i == item.updateTimes.length - 1) {
                    item.updateTime = "/" 
                    item.updateTimeInMilies = 0;
                    break;
                }          
            }
        }); 

    }
});

app.filter('searchFor', function(){

    // All filters must return a function. The first parameter
    // is the data that is to be filtered, and the second is an
    // argument that may be passed with a colon (searchFor:searchString)

    return function(arr, searchString){

        if(!searchString){
            return arr;
        }
        
        var result = arr;
        var filteredResult = [];

        if(searchString.query && searchString.query.length > 1) {

            // Using the forEach helper method to loop through the array
            angular.forEach(result, function(item){

                for(var i in searchString.query) {
                    var tableName = searchString.query[i].toLowerCase();
                    if (tableName.split(".").length > 1) {
                        tableName = tableName.split(".")[1];
                    }

                    if(item.name.toLowerCase().split(".")[1] == tableName){
                        filteredResult.push(item);
                    }
                }

            });

            result = filteredResult;
            filteredResult = [];
        }

        if(searchString.name) {
            var name = searchString.name.toLowerCase();

            // Using the forEach helper method to loop through the array
            angular.forEach(result, function(item){

                if(item.name.toLowerCase().indexOf(name) !== -1){
                    filteredResult.push(item);
                }

            });
            
            result = filteredResult;
            filteredResult = [];
        }

        if(searchString.date || searchString.date == ""){
            if(searchString.date.length > 9) {
            
                var day = searchString.date.split("/")[0];
                var month = searchString.date.split("/")[1];
                var year = searchString.date.split("/")[2];
                var date = new Date(year, month - 1, day, 0, 0, 0, 0);
            }

            else {
                var date = new Date();
            }
            DataSort.changeDate(result, date);     
        }  
        return result;
    };

});


// Config and Routes 
app.config(function($routeProvider){
    $routeProvider
        .when('/', {
            templateUrl: "warehouse.html"
        })
        .when('/stage/', {
            templateUrl: "stagearea.html"
        })
})

app.controller('LoadTables', function($scope, DataSort, $location) {
    DataSort.getData(function(data) {
        DataSort.sortData(data, DataSort.tables, "");
        $scope.tables = DataSort.tables;     
        $scope.filteredTables = DataSort.filterData($scope.tables);
    });

    $scope.limit = new Date("2014/12/14 1:02").getTime();
    $scope.clicked = [];
    if($location.path() == "/")
        $scope.warehouse = true;
    else
        $scope.warehouse = false;
    $scope.searchString;
    $scope.query;

    $scope.isClicked = function(table) {
        var index = $scope.clicked.indexOf(table.id);
        
        if(index == -1) {
            table.name = "-"+table.name.substring(1);
            $scope.clicked.push(table.id);
        }    
        else {
            table.name = "+"+table.name.substring(1);
            $scope.clicked.splice(index, 1);
        }          
    }

    $scope.isSelected = function(table) {
        for(var i in $scope.clicked) {
            if(table.parent == $scope.clicked[i])
                return true;
        }
        
        return false;
    }

    $scope.sort = function(type, tables) {

        if(!tables) {
        
            if(!$scope.warehouse)
                tables = $scope.tables;
            else
                tables = $scope.filteredTables;
        }

        if(type == 0) {
            tables.sort(function(a,b){
                if (a.name.substring(1) < b.name.substring(1))
                    return -1;
                if (a.name.substring(1) > b.name.substring(1))
                    return 1;
                return 0;
            });
        }
        else if (type == 1) {
            tables.sort(function(a,b){
                if (a.name.substring(1) > b.name.substring(1))
                    return -1;
                if (a.name.substring(1) < b.name.substring(1))
                    return 1;
                return 0;
            });
        }
          
        else if (type == 2 ) {
            tables.sort(function(a,b){
                return b.updateTimeInMilies - a.updateTimeInMilies;
            });
        }
        else if (type == 3 ) {
            tables.sort(function(a,b){
                return a.updateTimeInMilies - b.updateTimeInMilies;
            });           
        }
        for(var i in tables) {
            if(tables[i].dependencies.length > 0) {
                $scope.sort(type, tables[i].dependencies);
            }
        }
    }

    $scope.tab = function (tabIndex) {
     
        if (tabIndex == 1){
            $scope.warehouse = true;
            $location.path('/');
        }   
      
        if (tabIndex == 2){
            $scope.warehouse = false;
            $location.path('/stage/');
        }
    };

    //triggered on button click 'get tables'
    $scope.getQuery = function(query) {
        
        //extract tables
        if(query) {
            DataSort.extractTables(query);
            if(DataSort.queryTables < 1) 
                $scope.query = "no tables found"
            
            else {  
                $scope.searchString = {};
                $scope.searchString.query = DataSort.queryTables;
            }
        }
    }

    $scope.clearQuery = function() {
        $scope.query = "";
        if( $scope.searchString)
            $scope.searchString.query = [];
    }

    $scope.checkEmpty = function() {
        if($scope.query == "") {
            if( $scope.searchString)
                $scope.searchString.query = [];
        }
    }
});

$( "#datepicker" ).datepicker({
    inline: true,
    dateFormat: "dd/mm/yy"
});



