//set global variables
//user defined B&W and Color Cost
  var ud_tonerBWCost = .02;
  var ud_tonerColorCost = .09;
//Other global variables
  var currencySymbol = '$';
  var items = [];
  var itemsPerCopy = [];
  var itemsPerSubmission = [];
  var perCopyTotal = 0;
  var perSubmissionTotal = 0;
  var total = 0.00;
  var nonCoverSheets = 0;
  var totalSheets = 0;
  var errorMessage = '';
  var totalPages = 0;
  var colorPages = 0;
  var grayscalePages = 0;
  var copyCount = 0;

function estimateCost(order) {
    var estCostDescr = 'Please attach your file';

    //set global page count variables
    colorPages = order.pages.colorPages;
    grayscalePages = order.pages.grayscalePages;
    totalPages = colorPages + grayscalePages;
    copyCount = order.copies.quantity;

  //if the user has uploaded a document, call the cost functions for printing, additional items, finishing, etc.
    if (totalPages > 0) {
        estCostDescr = 'Items With ** Require Authorization';

        //most of the code is separated into different functions for readability.
        calculatePrinting(order);
        calculateAdditional(order);
        calculateFinishing(order);
        calculateAdditionalPerSubmission();
        calculateItemsAndTotal();
    }
  //if the errorMessage variable has been set to something, display the error message.
    if (errorMessage.length > 0) {
        items.length = 0;
        total = 0.00;
        estCostDescr = errorMessage;
    }
  //if no errorMessage is set, return the total, description, and items[] set by the functions above.
    return {
        total: total,
        description: estCostDescr,
        items: items
    };
}

//***--------------------------------***//
//***Function -> Calculate Printing ***//
//***------------------------------***//
function calculatePrinting(order) {
    var printingCost = 0;
    var printingDescription = '';
    var li_printing = {};

    //Checking for simplex vs duplex.  Also checking if a cover page is selected. The cover page should not be included in the sheet calculations. It is handled separately.
    if (order.printOnBothSides.enabled) {
        printingDescription += 'Duplex | ';
        if (order.frontCover.printOnCover == 'First page as cover') {
            nonCoverSheets = Math.ceil((totalPages - 1) / 2);
        } else {
            nonCoverSheets = Math.ceil(totalPages / 2);
        }
    } else {
        printingDescription += 'Simplex | ';
        nonCoverSheets = totalPages;
        if (order.frontCover.printOnCover == 'First page as cover') {
            nonCoverSheets = totalPages - 1;
        }
    }
    totalSheets = nonCoverSheets;

    //calculate/display color vs grayscale
    if (order.color.enabled) {
        printingDescription += 'Color Enabled | ';
    } else {
        printingDescription += 'Grayscale | ';
        colorPages = 0;
        grayscalePages = totalPages;
    }
    if (colorPages > 0) {
        printingDescription += 'Color Toner x ' + colorPages + (colorPages == 1 ? ' pg' : ' pgs') + ' [$' + (colorPages * ud_tonerColorCost).toString() + '] | ';
        printingCost += (colorPages * ud_tonerColorCost);
    }
    if (grayscalePages > 0) {
        printingDescription += 'B&W Toner x ' + grayscalePages + (grayscalePages == 1 ? ' pg' : ' pgs') + ' [$' + (grayscalePages * ud_tonerBWCost).toString() + '] | ';
        printingCost += (grayscalePages * ud_tonerBWCost);
    }

    //calculate/display paper stock selection
    printingDescription += order.paperStock.size + ", " + order.paperStock.color + ", " + order.paperStock.type + ' x ' + nonCoverSheets + (nonCoverSheets == 1 ? ' Sheet ' : ' Sheets ') + '[$' + (order.paperStock.cost * nonCoverSheets).toString() + ']' + ' | ';
    printingCost += (order.paperStock.cost * nonCoverSheets);

    //remove trailing '|' from printingDescription
    if (printingDescription.endsWith(' | ')) {
        printingDescription = printingDescription.slice(0, -3);
    }

    //Add the printing line item to items[].  Also add the printing cost to the total cost.
    li_printing = {
        name: 'Printing Costs (per copy)',
        description: printingDescription,
        cost: printingCost,
        style: 'OPTION_2'
    };
    itemsPerCopy.push(li_printing);
    perCopyTotal += printingCost;
}

//***------------------------------***//
//***Function -> Additional Items ***//
//***----------------------------***//
function calculateAdditional(order) {
    var additionalCost = 0;
    var additionalDescription = '';
    var formattedName = '';
    var li_additional = {};

    //check to see if there is a custom field set. If so, loop through the fields for the description and cost
    if (order.custom.fields.length > 0) {
        for (var i in order.custom.fields) {
            formattedName = '';
            additionalCost += order.custom.fields[i].option.cost;
            if (order.custom.fields[i].option.name != 'None') {
                formattedName = order.custom.fields[i].name;
                formattedName = (formattedName.indexOf('**') > -1 ? formattedName.substr(0, formattedName.indexOf('**') + 2) : formattedName);
                additionalDescription += formattedName + ': ' + order.custom.fields[i].option.name + ' [$' + order.custom.fields[i].option.cost + '] | ';
            }
        }
    }

    //remove trailing '|'
    if (additionalDescription.endsWith(' | ')) {
        additionalDescription = additionalDescription.slice(0, -3);
    }

    //add additional items to items[] and additional items cost to the total cost
    li_additional = {
        name: 'Additional Options (per copy)',
        description: additionalDescription,
        cost: additionalCost,
        style: 'OPTION_2'
    };
    itemsPerCopy.push(li_additional);
    perCopyTotal += additionalCost;
}
//***-------------------------------***//
//***Function -> Finishing Options ***//
//***-----------------------------***//
function calculateFinishing(order) {
    var ud_finishingOption = {};
    var finishingOptions = ['collating', 'frontCover', 'backCover', 'binding', 'cutting', 'holePunching', 'folding', 'laminating'];
    var finishingDescription = '';
    var finishingCost = 0;
    var li_finishing = {};
    var li_finishing_fixed = {};
    var itemCount = 0;
    var formattedName = '';
    var preText = '';
    var finishingDescription_fixed = '';
    var finishingCost_fixed = 0;
    var finishingHelperReturn = {};

    //Loop through every attribute in order
    for (var attribute in order) {
        itemCount = 0;
        formattedName = '';
        preText = '';

        //check if the current attribute is a finishing option.
        if (finishingOptions.indexOf(attribute) > -1) {
            //check to make sure the attribute has values set for this particular order
            for (var i in order[attribute]) {
                itemCount++;
                break;
            }
        }
        //if this is a finishing option with values set for the current order attribute
        if (itemCount > 0) {
            //set ud_finishingOption to the user defined pricing/description object by calling the finishingObject function ->pass in current attribute.
            ud_finishingOption = finishingObject(attribute);
            //if the user defined object is set to active and the current value is not the 'unselected' value,
            //then continue with calculating the finishing option cost and description
            if (ud_finishingOption.active == 'Yes' && order[attribute].name != ud_finishingOption.notSelectedVal) {
                //Check to see if the current finishing option has '**' in the name, which represents an item needing approval.
                //if it does, remove everything after '**' for readability.
                formattedName = order[attribute].name;
                formattedName = (formattedName.indexOf('**') > 0 ? formattedName.substr(0, formattedName.indexOf('**') + 2) : formattedName);

                //get preText for this attribute from the user defined object passed in and add it before the formatted finishing option name.
                preText = ud_finishingOption.preText + (ud_finishingOption.preText.length > 0 ? ': ' : ' ');
                finishingDescription += preText + formattedName;

                //if the current attribute is frontCover, add 1 to totalSheets.  Set the description for print on front cover or not
                if (attribute == 'frontCover') {
                    totalSheets++;
                    if (order[attribute].printOnCover == 'First page as cover') {
                        finishingDescription += ' (First Page As Cover)';
                    }
                    else if (order[attribute].printOnCover == 'Blank cover') {
                        finishingDescription += ' (Blank Cover)';
                    }
                }
                //add 1 to total sheets if the current attribute is back cover.
                else if (attribute == 'backCover') {
                    totalSheets++;
                }

                //to help with readability, the description/cost calculations are completed in a helper function.
                //pass the the current order attribute object and the user defined object.

                finishingHelperReturn = finishingHelper(order[attribute], ud_finishingOption);

                finishingDescription += finishingHelperReturn.description;
                finishingCost += finishingHelperReturn.cost;

                finishingDescription_fixed += finishingHelperReturn.description_fixed;
                finishingCost_fixed += finishingHelperReturn.cost_fixed;
            }
        }
    }

    //remove trailing '|'
    if (finishingDescription.endsWith(' | ')) {
        finishingDescription = finishingDescription.slice(0, -3);
    }

    //add finishing options to items[] and finishging cost to the total cost
    li_finishing = {
        name: 'Finishing Options (per copy)',
        description: finishingDescription,
        cost: finishingCost,
        style: 'OPTION_2'
    };
    itemsPerCopy.push(li_finishing);
    perCopyTotal += finishingCost;

    //add fixed finishing options to items[] and fixed finishging cost to the total cost
    li_finishing_fixed = {
        name: 'Finishing Options (per submision)',
        description: finishingDescription_fixed,
        cost: finishingCost_fixed,
        style: 'OPTION_2'
    };
    itemsPerSubmission.push(li_finishing_fixed);
    perSubmissionTotal += finishingCost_fixed;
}

//***-------------------------------------***//
//***Function -> Finishing Option Helper ***//
//***-----------------------------------***//
function finishingHelper(orderObj, ud_finishingOptionObj) {
    var finishingDescription = '';
    var finishingCost = 0;
    var helperReturn = {};
    var sheetsName = [];
    var sheetsLimit = [];
    var sheetsCost = [];
    var sheetsMax = 0;
    var tempCost = 0;
    var index = 0;
    var formattedName = '';
    var ud_obj_copy;
    var price_split = [];
    var finishingDescription_fixed = '';
    var finishingCost_fixed = 0;
    var finishingHelperReturn = {};

    formattedName = orderObj.name;
    formattedName = (formattedName.indexOf('**') > 0 ? formattedName.substr(0, formattedName.indexOf('**') + 2) : formattedName);


    //check for pricingType of the user defined object and calculate cost/description accordingly
    if (ud_finishingOptionObj.price.pricingType == 'JSON Value'){
        finishingDescription += ' [$' + orderObj.cost + '] | ';
        finishingCost += orderObj.cost;
    }
    else if(ud_finishingOptionObj.price.pricingType == 'perXsheets-sheets'){
        //set error message if totalSheets > perXsheets.max
        sheetsMax = ud_finishingOptionObj.price.perXsheets.max;
        if (sheetsMax < totalSheets) {
            errorMessage = 'Selection for ' + ud_finishingOptionObj.name  + ' exceeds limit.  ' + 'Total Sheets: ' + totalSheets + ' > Max: ' + sheetsMax + '.  Please update/remove the selection or contact the print shop with questions.';
        }
        else {
            tempCost = Math.ceil(totalSheets / ud_finishingOptionObj.price.perXsheets.sheets) * orderObj.cost;
            finishingDescription += ' x ' + totalSheets + (totalSheets == 1 ? ' Sheet ' : ' Sheets ') + '[$' + tempCost + '] | ';
            finishingCost += tempCost;
        }
    }
    else if(ud_finishingOptionObj.price.pricingType == 'perXsheets-thresholds'){
        //set error message if totalSheets > perXsheets.max
        sheetsMax = ud_finishingOptionObj.price.perXsheets.max;
        if (sheetsMax < totalSheets) {
            errorMessage = 'Selection for ' + ud_finishingOptionObj.name + ' exceeds limit.  ' + 'Total Sheets: ' + totalSheets + ' > Max: ' + sheetsMax + '.  Please update/remove the selection or contact the print shop with questions.';
        }
        else{
            for (var t in ud_finishingOptionObj.price.perXsheets.thresholds){
                sheetsName.push(t);
                sheetsLimit.push(ud_finishingOptionObj.price.perXsheets.thresholds[t].limit);
                sheetsCost.push(ud_finishingOptionObj.price.perXsheets.thresholds[t].cost);
            }

            while (totalSheets >= sheetsLimit[index]) {
                index++;
            }
            tempCost = sheetsCost[index];
            finishingDescription += ' (' + sheetsName[index] + ') [$' + tempCost + '] | ';
            finishingCost += tempCost;
        }
    }
    else if (ud_finishingOptionObj.price.pricingType == 'Options'){
        finishingHelperReturn = finishingHelper(orderObj, ud_finishingOptionObj.options[formattedName]);

        finishingDescription += finishingHelperReturn.description;
        finishingCost += finishingHelperReturn.cost;

        finishingDescription_fixed += finishingHelperReturn.description_fixed;
        finishingCost_fixed += finishingHelperReturn.cost_fixed;
        }
    else if (ud_finishingOptionObj.price.pricingType == 'Binding subAttributes'){
        for (var attribute in orderObj.attributes){
        finishingDescription += ' (' + orderObj.attributes[attribute].option.name + ') ' +
        '[$' + orderObj.attributes[attribute].option.cost + '] | ';
        finishingCost += orderObj.attributes[attribute].option.cost;
        }
    }
    else if (ud_finishingOptionObj.price.pricingType == 'fixedFee'){
        finishingDescription_fixed += ud_finishingOptionObj.price.fixedFee.description;
        finishingCost_fixed += ud_finishingOptionObj.price.fixedFee.cost;
    }
    else if (ud_finishingOptionObj.price.pricingType.indexOf('|&|') > 0){

        price_split = ud_finishingOptionObj.price.pricingType.split('|&|');
        index=0;
        while(index < price_split.length){
            ud_obj_copy = ud_finishingOptionObj;
            ud_obj_copy.price.pricingType = price_split[index];

            finishingHelperReturn = finishingHelper(orderObj, ud_obj_copy);

            finishingDescription += finishingHelperReturn.description;
            finishingCost += finishingHelperReturn.cost;

            finishingDescription_fixed += finishingHelperReturn.description_fixed;
            finishingCost_fixed += finishingHelperReturn.cost_fixed;

            index++;

        }


    }
    helperReturn = {
        description: finishingDescription,
        cost: finishingCost,
        description_fixed: finishingDescription_fixed,
        cost_fixed: finishingCost_fixed
    };
    return helperReturn;
}
//***--------------------------------------------***//
//***Function -> calculateAdditionalPerSubmission ***//
//***------------------------------------------***//

function calculateAdditionalPerSubmission(){
    var li_perSubmission = [];
    var ud_APS_cost = 0.5;
    var ud_APD_description = 'Setup Cost (per submission)';

        li_perSubmission = {
        name: ud_APD_description,
        description: '',
        cost: ud_APS_cost,
        style: 'OPTION_2'
    };

    itemsPerSubmission.push(li_perSubmission);
    perSubmissionTotal += ud_APS_cost;
}
//***--------------------------------------------***//
//***Function -> calculateItemsAndTotal ***//
//***------------------------------------------***//
function calculateItemsAndTotal(){
    var li_perCopy = {};
    var li_perSubmission = {};
    var perCopyDescription = '';
    var perCopyCostFinal = 0;
//This function builds the final items[] and total to be displayed from global variables itemsPerCopy[],perCopyTotal, itemsPerSubmission [], & perSubmissionTotal
//the functions above set an items array for perCopy vs perSubmission costs.
        //the code below adds a summary line item for each type and then adds both to items[]

        //perCopy
        perCopyDescription += '$' + perCopyTotal + ' per copy x ' + copyCount + (copyCount == 1 ? ' copy' : ' copies');
        perCopyCostFinal += perCopyTotal * copyCount;

        li_perCopy = {
        name: 'Total Per Copy Cost',
        description: perCopyDescription,
        cost: perCopyCostFinal,
        style: 'OPTION_1'
    };

    itemsPerCopy.push(li_perCopy);
    total += perCopyCostFinal;

    for (var i=0; i < itemsPerCopy.length; i++){
    items.push(itemsPerCopy[i]);
    }

    for (var c=0; c < itemsPerSubmission.length; c++){
    items.push(itemsPerSubmission[c]);
    }

        //perSubmission Summary line item

        li_perSubmission = {
        name: 'Total Per Submission Cost',
        description: '',
        cost: perSubmissionTotal,
        style: 'OPTION_1'
    };

    items.push(li_perSubmission);
    total += perSubmissionTotal;
}


//***--------------------------------------------***//
//***Function -> FinishingOption [User Defined] ***//
//***------------------------------------------***//
function finishingObject(attribute) {
    //create an array of objects to define how the description and cost for finishing options are calculated.
    //return the object for the attribute passed in

/*
Each object must contain these 5 properties:
-name: -> the name of the object.  This version of javascript does not have a good way to get the name of the current object, so defining it within the object for reference.
-active: -> whether or not you want to calculate a price/description for the attribute). ['Yes'/'No']
-notSelectedVal: -> the value set in the JSON as the default choice if the user does not selected anything. [Typicaly 'None' or 'Not Selected']
-preText: -> Text before the attribute in the description.  [Typically blank or the finishing option name formatted]
-price: -> Details on price are below.  Separated for readability.
=== === === === === === === === === === === ===
**price**
Each price must contain a pricingType property
---
**pricingType** property options
1)'JSON Value' -> This options is typically used for frontCover and backCover.  The quantity is always 1 and the price is defined in the JSON file.
2)'perXsheets-sheets'
3)'perXsheets-thresholds'
4)'Options'
5)'subAttributes'
6)'fixedFee'
//items with multiple pricing options are separated by '|&|'
7)'perXsheets-sheets|&|fixedFee'
---
*/

    var ud_finishingOptions = {};
    //collating
    var collating = {
        name: 'Collating',
        active: 'Yes',
        notSelectedVal: 'None',
        preText: '',
        price: {pricingType: 'JSON Value'}
    };
    ud_finishingOptions.collating = collating;
    //frontCover
    var frontCover = {
        name: 'Front Cover',
        active: 'Yes',
        notSelectedVal: 'None',
        preText: 'Front Cover',
        price: {pricingType: 'JSON Value'}
    };
    ud_finishingOptions.frontCover = frontCover;
    //backCover
    var backCover = {
        name: 'Back Cover',
        active: 'Yes',
        notSelectedVal: 'None',
        preText: 'Back Cover',
        price: {pricingType: 'JSON Value'}
    };
    ud_finishingOptions.backCover = backCover;
    //binding
    var binding = {
        name: 'Binding',
        active: 'Yes',
        notSelectedVal: 'None',
        preText: 'Binding',
        price: {pricingType: 'Options'},
        options: {
            'Stapling': {
                name: 'Stapling',
                price: {pricingType: 'Binding subAttributes'}
            },
            'Thermal Bind**': {
                name: 'Thermal Bind**',
                price: {pricingType: 'perXsheets-sheets', perXsheets: {sheets: 1, 'max': 100}}
            },
            'Twin Loop**': {
                name: 'Twin Loop**',
                price: {pricingType: 'perXsheets-thresholds', perXsheets: {
                        thresholds: {
                            '1/4\"': {limit: 50, cost: .64},
                            '5/8\"': {limit: 125, cost: .96}
                        },
                        'max': 125}}
            },
            'Comb Binding**': {
                name: 'Comb Binding**',
                price: {pricingType: 'perXsheets-thresholds', perXsheets: {
                        thresholds: {
                            '1/4\"': {limit: 50, cost: .44},
                            '3/8\"': {limit: 75, cost: .53},
                            '1/2\"': {limit: 100, cost: .64},
                            '5/8\"': {limit: 125, cost: .76},
                            '1\"': {limit: 200, cost: 1.01}
                        },
                        'max': 200}}
            },
        }};
    ud_finishingOptions.binding = binding;
    //cutting
    var cutting = {
        name: 'Cutting',
        active: 'Yes',
        notSelectedVal: 'None',
        preText: '',
        price: {pricingType: 'perXsheets-thresholds', perXsheets: {
                thresholds: {
                    '< 200 Sheets': {limit: 200, cost: 6.00},
                    '> 200 Sheets': {limit: 1000000, cost: 12.00}
                },
                'max': 1000000}}
    };
    ud_finishingOptions.cutting = cutting;

    //holePunching
    var holePunching = {
        name: 'Hole Punching',
        active: 'Yes',
        notSelectedVal: 'None',
        preText: '',
        price: {pricingType: 'Options'},
        options: {
            '3 Hole Punch (Left)': {
                name: '3 Hole Punch (Left)',
                price: {pricingType: 'perXsheets-sheets', perXsheets: {sheets: 1,'max': 1000000}}
            },
            'Hole Drilling**': {
                name: 'Hole Drilling**',
                price: {pricingType: 'perXsheets-thresholds', perXsheets: {
                        thresholds: {
                            '< 200 Sheets': {limit: 200, cost: 6.00},
                            '> 200 Sheets': {limit: 1000000, cost: 12.00}},
                        'max': 1000000}}}
        }};
    ud_finishingOptions.holePunching = holePunching;
    //folding
    var folding = {
        name: 'Folding',
        active: 'Yes',
        notSelectedVal: 'None',
        preText: '',
        price: {pricingType: 'perXsheets-sheets|&|fixedFee',
            perXsheets: {sheets: 100, 'max': 1000000},
            fixedFee: {cost: 6.00, description: 'Folding: $6.00 Setup Cost'}
        }};
    ud_finishingOptions.folding = folding;
    //laminating
    var laminating = {
        name: 'Laminating',
        active: 'No',
        notSelectedVal: 'None',
        preText: 'Laminating',
        price: {pricingType: 'JSON Value'}
    };
    ud_finishingOptions.laminating = laminating;

//return
    return ud_finishingOptions[attribute];
}
