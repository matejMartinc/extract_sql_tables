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
var tables = [];

//erase textarea and list of tables
var erase = function() {
    document.getElementById("queryText").value = "";
    removeItems();
}

//triggered on button click 'get tables'
var getQuery = function() {
    tables = [];
    removeItems();

    //get query from text area 
	var query = document.getElementById("queryText").value;

    //extract tables
	extractTables(query);

    //add tables to list or add 'no tables' if no tables are found in a query
    if(tables.length == 0) {
        addItem("no tables");
    }
    else {
        for(var i in tables) {
            addItem(tables[i]);
        } 
    }
}

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
var extractTables = function(query) {
  
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

        console.log(query);

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
            if(aliases[0].trim() != "subconsulta" && tables.indexOf(aliases[0].trim()) == -1) {
                tables.push(aliases[0].trim());  
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

//add item to list
var addItem = function(tableName) {
    var ul = document.getElementById("list");
    var li = document.createElement("li");
    li.appendChild(document.createTextNode(tableName));
    ul.appendChild(li);
}

//remove all items from a list
var removeItems = function() {
    var myNode = document.getElementById("list");
    myNode.innerHTML = '';
}