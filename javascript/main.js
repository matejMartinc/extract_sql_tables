
var app = angular.module('app', ['ngRoute', 'ngSanitize', 'ngCsv']);

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

            //change text to lowercase, remove line breaks, unnecessary white space and comments
            query = query.toLowerCase();
            query = query.replace(/\n/g, ' ');
            query = query.replace(/ +/g, ' ');
            query = query.replace(/ +,/g, ',');
            query = query.replace(/\/\*[^\*\/]*\*\//g, '');

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

    //find tables from query that are not defined in the list 
    this.checkForUndefinedTables = function(tableArray, scheme) {
        var noMatch = "";
        var noScheme = ""
        for(var i in me.queryTables) {
            var tableName = me.queryTables[i].toLowerCase();
            for(var j in tableArray){
                
                if (tableName.split(".").length > 1) {
                    if(tableArray[j].name.toLowerCase().substring(2) == tableName){
                        break;
                    }       
                }
                else { 
                    if(scheme == "choose your scheme") {
                        noScheme += "\n" + me.queryTables[i];
                        break;
                    }
                    else {
                        if(tableArray[j].name.toLowerCase().substring(2) == scheme.toLowerCase() + "." + tableName){
                            me.queryTables[i] = scheme + "." + tableName;
                            break;
                        }   
                    }     
                }
                if(j == tableArray.length - 1) {
                    if (tableName.split(".").length > 1) {
                        noMatch += "\n" + me.queryTables[i];
                    }

                    else {
                        noMatch += "\n" + scheme + "." + me.queryTables[i];
                    }
                }
            }
        } 
        return [noMatch, noScheme];
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

    //creates unique id for every table object in the list
    this.idGenerator = function() {
        var S4 = function() {
           return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        };
        return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
    }

    //fetch data from csv files and save them in the 'tables' object that enables efficient further processing
    this.getData = function(callback) {
        $http.get("./data/dependencias.csv")
            .then(function(response1) {
                $http.get("./data/actualizaciones.csv")
                .then(function(response2) {
                    
                    var tables = {};

                    //create array of table and dependency data
                    var dependencyArray = CSVToArray(response1.data, ';');
                    var tableArray = CSVToArray(response2.data, ';');
                    
                    for(var i in tableArray) {
                        if(i != 0 && tableArray[i].length == 3) {

                            //split date string and create Date object
                            var name = tableArray[i][0] + "." + tableArray[i][1];
                            var updateTime = tableArray[i][2];
                            var dayandhour= updateTime.split(" ");
                            var day = dayandhour[0].split("/");
                            updateTime = new Date(day[2] + "/" + day[1] + "/" + day[0] + " " + dayandhour[1]);

                            //add tables name with array of update times to tables object
                            if (tables.hasOwnProperty(name)) {
                                tables[name][0].push(updateTime);
                            }
                            else {
                                tables[name] = [[],[]];
                                tables[name][0].push(updateTime);
                            }
                        }
                    }

                    //add dependencies to tables inside tables object
                    for(var i in dependencyArray) {
                        if(i != 0 && dependencyArray[i].length == 4) {
                            var name = dependencyArray[i][0] + "." + dependencyArray[i][1];
                            var dependencyName = dependencyArray[i][2] + "." + dependencyArray[i][3];
                            tables[name][1].push(dependencyName);  
                        }
                    }

                    //call this callback function after data is read and tables object is created
                    callback(tables);  
                });
            });
    }

    //empty array that is used for storing tables as objects
    this.tables = [];

    //rescursive function for creating objects with table id, name dependencies and dates. Tables are stored in list
    this.sortData = function(data, tables, parent) {
        for (var property in data) {
            if (data.hasOwnProperty(property)) {

                //sort updatetimes array by date, from newest to oldesr
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

                //check if tables has dependencies and sort them recursively
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

                    //this is empty string if table is on first level, or name of the table, if table is a dependnecy
                    "parent" : parent,
                    "name" : property,

                    //newest updateTime as string
                    "updateTime" : day + "/" + (month + 1) + "/" + year + " " + hours + ":" + minutes, 

                    //newest update written in milliseconds, used for sorting
                    "updateTimeInMilies" : updates[0].getTime(),
                    "dependencies" : newTables,
                    "updateTimes" : updates
                }
                tables.push(table);   
            }            
        }
    }

    //split data to warehouse and stage area
    this.splitData = function(data) {
        var warehouseTables = [];
        var stageAreaTables = [];
        var schemes = ["all schemes"];
        var addSchemes = ["choose your scheme"];
        for(var i in data) {
            
            if(data[i].dependencies.length != 0) 
                warehouseTables.push(data[i]); 
            else
                stageAreaTables.push(data[i]);
            var scheme = (data[i].name.split(".")[0]).substring(2);
            if(schemes.indexOf(scheme) == -1 ) {
                schemes.push(scheme);
                addSchemes.push(scheme);  
            }

        }
        return [warehouseTables, stageAreaTables, schemes, addSchemes];
    }

    //recursive function for date filtering
    this.changeDate = function(data, date) {
        
        angular.forEach(data, function(item){

            for(var i in item.updateTimes) {

                //if table has dependencies, change update time recursively for dependencies
                if(item.dependencies.length > 0) {
                    me.changeDate(item.dependencies, date);
                }

                //find update time, that is older than the time specified in filter
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

                //if there is no older time, write no data
                else if (update.getTime() > date.getTime() && i == item.updateTimes.length - 1) {
                    item.updateTime = "no data" 
                    item.updateTimeInMilies = 0;
                    break;
                }          
            }
        }); 

    }

    this.filter = function(arr, scope) {
        
        if(!scope.filter){
            return arr;
        }

        console.log("jej2")
        
        var result = arr;
        var filteredResult = [];

        //filter by list of tables found in the query
        if(scope.filter.query && scope.filter.query.length > 0) {
            
            // Using the forEach helper method to loop through the array
            angular.forEach(result, function(item){

                for(var i in scope.filter.query) {
                    var tableName = scope.filter.query[i].toLowerCase();
                   
                    if(item.name.toLowerCase().substring(2) == tableName){       
                        filteredResult.push(item);
                        break;
                    }      
                }
            });

            result = filteredResult;
            filteredResult = [];


        }

        //filter by name
        if(scope.filter.name) {
            var name = scope.filter.name.toLowerCase();

            // Using the forEach helper method to loop through the array
            angular.forEach(result, function(item){

                if(item.name.toLowerCase().indexOf(name) !== -1){
                    filteredResult.push(item);
                }

            });
            
            result = filteredResult;
            filteredResult = [];
        }

        //filter by scheme
        if(scope.filter.chooseScheme != "all schemes") {
            
            var scheme = scope.filter.chooseScheme.toLowerCase();

            //if we are filtering query, scheme filter works differently 
            /*if(scope.filter.query && scope.filter.query.length > 0) {
                var query = {};

                angular.forEach(result, function(item){
                    for(var i in scope.filter.query) {
                        var tableName = scope.filter.query[i].toLowerCase();

                        //find tables that have scheme defined and include them in result
                        if(item.name.toLowerCase().substring(2) == tableName) {
                            filteredResult.push(item);
                        }

                        //find tables without defined scheme
                        else if(tableName.split(".").length == 1){
                            if(item.name.toLowerCase().split(".")[1] == tableName) {
                                if(!query.hasOwnProperty(tableName)) {
                                     query[tableName] = [[],[]]; 
                                }
                                query[tableName][0].push(item.name.split(".")[0]);
                                query[tableName][1].push(item);
                            }
                        }
                    
                    }
                    
                });
               
                
                for(var name in query) {
                    if (query.hasOwnProperty(name)) {
                        var filter1 = "- " + scope.filter.scheme;
                        var filter2 = "+ " + scope.filter.scheme;

                        //if there is just one scheme for the table possible or filtered scheme is not possible,
                        //include the tables from all schemes that are not defined by filter
                        if(query[name][0].length == 1 || (query[name][0].indexOf(filter1) == -1 && query[name][0].indexOf(filter2) == -1)) {
                            
                            for(var i in query[name][0]) {
                                filteredResult.push(query[name][1][i]);
                            }
                            
                        }

                        //otherwise include just the table from a filtered scheme
                        else {
                            if(query[name][0].indexOf(filter1) != -1) {
                                filteredResult.push(query[name][1][query[name][0].indexOf(filter1)]);
                            }
                            else if(query[name][0].indexOf(filter2) != -1) {
                                filteredResult.push(query[name][1][query[name][0].indexOf(filter2)]);
                            }
                        }
                    }
                } 

                //remove duplicates from the result
                var names = []
                var noDuplicates = [];
                for(var i in filteredResult) {
                    if(names.indexOf(filteredResult[i].id) == -1) {
                        names.push(filteredResult[i].id);
                        noDuplicates.push(filteredResult[i]);
                    }
                }
                filteredResult = noDuplicates;
            }
            */

            

            // filter by scheme
            angular.forEach(result, function(item){

                if((item.name.toLowerCase().split(".")[0]).substring(2) == scheme){
                    filteredResult.push(item);
                }

            });
            
            
            result = filteredResult;
            filteredResult = [];    
        }



        //filter by date 
        if(scope.filter.date || scope.filter.date == ""){
            if(scope.filter.date.length > 9) {
            
                var day = scope.filter.date.split("/")[0];
                var month = scope.filter.date.split("/")[1];
                var year = scope.filter.date.split("/")[2];
                var date = new Date(year, month - 1, day, 23, 59, 59, 0);
            }

            else {
                var date = new Date();
            }
            scope.limit = date.getTime() - (1000 * 60 * 60 * 24 * dayLimit);
            me.changeDate(result, date);     
        }
        
        return result;
    };

});

//filter tables list
app.filter('searchFor', function(DataSort){

    // All filters must return a function. The first parameter
    // is the data that is to be filtered, and the second is an
    // argument that may be passed with a colon (searchFor:filter)

    return DataSort.filter;
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

//controller for the app. Loads data and sorts it
app.controller('LoadTables', function($scope, DataSort, $location) {
    DataSort.getData(function(data) {
        DataSort.sortData(data, DataSort.tables, "");     
        
        var splitedData = DataSort.splitData(DataSort.tables);

        $scope.warehouseTables = splitedData[0];
        $scope.stageAreaTables = splitedData[1];
        $scope.filter = {};
        $scope.query = "";
        $scope.schemes = splitedData[2];
        $scope.addSchemes = splitedData[3];
        $scope.filter.chooseScheme = "all schemes";
        $scope.filter.addScheme = "choose your scheme";
        $scope.sort(3, $scope.warehouseTables);
        $scope.sort(3, $scope.stageAreaTables);
        $scope.sortOrder = 3;
    });

    $scope.limit = new Date().getTime() - (1000 * 60 * 60 * 24 * dayLimit);

    //list of 'opened tables' (dependencies are visible)
    $scope.clicked = [];

    //find the right data on page load (warehouse or stage area)
    if($location.path() == "/" || $location.path() == "")
        $scope.warehouse = true;
    else
        $scope.warehouse = false;

    //on table click push table to the list of openend tables or remove it from the list if table is already there
    $scope.isClicked = function(table) {
        var index = $scope.clicked.indexOf(table.id);
        if(table.dependencies.length > 0) {
            if(index == -1) {
                table.name = "-"+table.name.substring(1);
                $scope.clicked.push(table.id);
            }    
            else {
                table.name = "+"+table.name.substring(1);
                $scope.clicked.splice(index, 1);
            }    
        }      
    }

    //find out if table is opened
    $scope.isSelected = function(table) {
        for(var i in $scope.clicked) {
            if(table.parent == $scope.clicked[i])
                return true;
        }
        
        return false;
    }

    //this function takes care of sorting by name or date
    $scope.sort = function(type, tables) {

        $scope.sortOrder = type;

        if(!tables) {
        
            if(!$scope.warehouse)
                tables = $scope.stageAreaTables;
            else
                tables = $scope.warehouseTables;
        }

        //alphabetical order
        if(type == 0) {
            tables.sort(function(a,b){
                if (a.name.substring(1) < b.name.substring(1))
                    return -1;
                if (a.name.substring(1) > b.name.substring(1))
                    return 1;
                return 0;
            });
        }

        //reverse alphabetical order
        else if (type == 1) {
            tables.sort(function(a,b){
                if (a.name.substring(1) > b.name.substring(1))
                    return -1;
                if (a.name.substring(1) < b.name.substring(1))
                    return 1;
                return 0;
            });
        }
          
        //sort from newest to oldest date
        else if (type == 2 ) {
            tables.sort(function(a,b){
                return b.updateTimeInMilies - a.updateTimeInMilies;
            });
        }

        //sort from oldest to newest date
        else if (type == 3 ) {
            tables.sort(function(a,b){
                return a.updateTimeInMilies - b.updateTimeInMilies;
            });           
        }

        //do the same recursively for dependencies
        for(var i in tables) {
            if(tables[i].dependencies.length > 0) {
                $scope.sort(type, tables[i].dependencies);
            }
        }
    }

    //switch between warehouse and stage area
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
            if(DataSort.queryTables < 1) { 
                $scope.query += "\n\nno tables found";
                return;
            }
            else {  
                if(!$scope.filter)
                    $scope.filter = {};
                $scope.filter.query = DataSort.queryTables;
            }

            //check for tables in the query that are not in the list
            if($scope.warehouse)
                var undefinedTables = DataSort.checkForUndefinedTables($scope.warehouseTables, $scope.filter.addScheme);
            else
                var undefinedTables = DataSort.checkForUndefinedTables($scope.stageAreaTables, $scope.filter.addScheme);
            if(undefinedTables[0].length > 0) {
                $scope.query += "\n\nFollowing tables from query were not found in a list:";
                $scope.query += undefinedTables[0];
                $scope.filter.query = ["error"];
            }
            if(undefinedTables[1].length > 0) {
                $scope.query += "\n\nNo scheme is specified for tables:";
                $scope.query += undefinedTables[1];
                $scope.filter.query = ["error"];
            }
        }
    }

    //triggered on button click clear
    $scope.clearQuery = function() {
        $scope.query = "";
        if( $scope.filter)
            $scope.filter.query = [];
    }

    //no queries found, remove the query filter
    $scope.checkEmpty = function() {
        if($scope.query == "") {
            if( $scope.filter)
                $scope.filter.query = [];
        }
    }
    
    //triggered on export button click
    $scope.exportArray = function() {
        
        var csvArray = [];
        var query = $scope.query;
        query = query.replace(/\n/g, ' ');
        query = query.replace(/"/g, '');

        //if query, split it into 80 characters long lines
        if(query.length > 0) {
            var queryLine = [];
            var queryPart = "";
            counter = 0;
            for (var i = 0; i < query.length; i++) {
                if(counter == 0) {
                    queryPart+="##";
                }
                if(query[i] == ",") {
                    queryLine.push(queryPart);
                    queryPart = "";
                }
                else {
                    queryPart += query[i];
                }
                counter++;

                if(i == query.length - 1) {
                    queryLine.push(queryPart);
                    csvArray.push(queryLine);
                }
                if(counter >= 80) {
                    if(query[i] == " ") {
                        queryLine.push(queryPart);
                        csvArray.push(queryLine);
                        queryPart = "";
                        counter = 0;
                        queryLine = [];
                    }
                }
            }
        }

        //sort tables the same way as they are sorted on the page
        $scope.sort($scope.sortOrder, $scope.warehouseTables);
        $scope.sort($scope.sortOrder, $scope.stageAreaTables);

        //filter tables
        csvArray.push(["##warehouse"]);
        $scope.createCsv(DataSort.filter($scope.warehouseTables, $scope), csvArray, "");
        csvArray.push(["##stage area"]);
        $scope.createCsv(DataSort.filter($scope.stageAreaTables, $scope), csvArray, "");
        return csvArray;
    } 

    //recursive function for writing tables to the array as string that is then written to csv file
    $scope.createCsv = function(tables, array, space, scope) {
        for(var i in tables) {
            var tableArray = [];
            tableArray.push("##" + space + tables[i].name.substring(2));
            tableArray.push(tables[i].updateTime);
            if(tables[i].updateTimeInMilies > $scope.limit) {
                tableArray.push("OK");
            }
            else {
                tableArray.push("NOT OK");
            }
           
            array.push(tableArray);
            if(tables[i].dependencies.length > 0) {
                var newSpace = space + "\t"
                $scope.createCsv(tables[i].dependencies, array , newSpace, scope);
            }
        }
    }
    
});

//initialize dropdown for schemes
app.run(function($rootScope) {
    angular.element(document).on("click", function(e) {
        $rootScope.$broadcast("documentClicked", angular.element(e.target));
    });
});

//create dropdown directive
app.directive("dropdown", function($rootScope) {
    return {
        restrict: "E",
        templateUrl: "./dropdown.html",
        scope: {
            list: "=",
            selected: "=",
        },
        link: function(scope) {
            scope.listVisible = false;

            scope.select = function(item) {
                scope.selected = item;
            };

            scope.isSelected = function(item) {
                return item === scope.selected;
            };

            scope.show = function() {
                scope.listVisible = true;
            };

            $rootScope.$on("documentClicked", function(inner, target) {
                if (!$(target[0]).is(".dropdown-display.clicked") && !$(target[0]).parents(".dropdown-display.clicked").length > 0)
                    scope.$apply(function() {
                        scope.listVisible = false;
                    });
            });

            scope.$watch("selected", function(value) {
                scope.display = scope.selected;
            });
        }
    }
});

//initialize calendar
$( "#datepicker" ).datepicker({
    inline: true,
    dateFormat: "dd/mm/yy"
});
