/**
 * Return Search results with the given search terms.
 *
 * "or" is the default operator, AND and NOT are also supported - as is any other valid fts-alfresco
 * elements such as "quoted terms" and (bracket terms) and also propname:propvalue syntax.
 *
 * @param params  Object containing search parameters - see API description above
 */
function getSearchResults(params)
{
    var nodes,
        ftsQuery = "",
        term = params.term,
        tag = params.tag,
        formData = params.query,
        rootNode = params.rootNode ? resolveRootNode(params.rootNode) : null;

    // Simple keyword search and tag specific search
    if (term !== null && term.length !== 0)
    {
        // TAG is now part of the default search macro
        ftsQuery = term + " ";
    }
    else if (tag !== null && tag.length !== 0)
    {
        // Just look for tag
        ftsQuery = "TAG:" + tag +" ";
    }

    // Advanced search form data search.
    // Supplied as json in the standard Alfresco Forms data structure:
    //    prop_<name>:value|assoc_<name>:value
    //    name = namespace_propertyname|pseudopropertyname
    //    value = string value - comma separated for multi-value, no escaping yet!
    // - underscore represents colon character in name
    // - pseudo property is one of any cm:content url property: mimetype|encoding|size
    // - always string values - interogate DD for type data
    // - an additional "-mode" suffixed parameter for a value is allowed to specify
    //   either an AND or OR join condition for multi-value property searches
    if (formData !== null && formData.length !== 0)
    {
        var formQuery = "",
            formJson = jsonUtils.toObject(formData);

        // extract form data and generate search query
        var first = true;
        var useSubCats = false;
        for (var p in formJson)
        {
            if (logger.isLoggingEnabled())
                logger.log("Form Data:" + formData);
            // retrieve value and check there is someting to search for
            // currently all values are returned as strings
            var propValue = formJson[p], modePropValue = formJson[p + "-mode"];
            if (propValue.length !== 0)
            {
                if (p.indexOf("prop_") === 0 && p.match("-mode$") != "-mode")
                {
                    // found a property - is it namespace_propertyname or pseudo property format?
                    var propName = p.substr(5);
                    if (propName.indexOf("_") !== -1)
                    {
                        // property name - convert to DD property name format
                        propName = propName.replace("_", ":");

                        // special case for range packed properties
                        if (propName.match("-range$") == "-range")
                        {
                            // currently support text based ranges (usually numbers) or date ranges
                            // range value is packed with a | character separator

                            // if neither value is specified then there is no need to add the term
                            if (propValue.length > 1)
                            {
                                var from, to, sepindex = propValue.indexOf("|");
                                if (propName.match("-date-range$") == "-date-range")
                                {
                                    // date range found
                                    propName = propName.substr(0, propName.length - "-date-range".length)

                                    // work out if "from" and/or "to" are specified - use MIN and MAX otherwise;
                                    // we only want the "YYYY-MM-DD" part of the ISO date value - so crop the strings
                                    from = (sepindex === 0 ? "MIN" : propValue.substr(0, 10));
                                    to = (sepindex === propValue.length - 1 ? "MAX" : propValue.substr(sepindex + 1, 10));
                                }
                                else
                                {
                                    // simple range found
                                    propName = propName.substr(0, propName.length - "-range".length);

                                    // work out if "min" and/or "max" are specified - use MIN and MAX otherwise
                                    from = (sepindex === 0 ? "MIN" : propValue.substr(0, sepindex));
                                    to = (sepindex === propValue.length - 1 ? "MAX" : propValue.substr(sepindex + 1));
                                }
                                formQuery += (first ? '' : ' AND ') + escapeQName(propName) + ':"' + from + '".."' + to + '"';
                                first = false;
                            }
                        }
                        else if (isCategoryProperty(formJson, p))
                        {
                            // If there's no suffix it means this property holds the value for categories
                            if (propName.indexOf("usesubcats") == -1 && propName.indexOf("isCategory") == -1)
                            {
                                // Determines if the checkbox use sub categories was clicked
                                if (formJson[p + "_usesubcats"] == "true")
                                {
                                    useSubCats = true;
                                }

                                // Build list of category terms to search for
                                var catQuery = "";
                                var cats = propValue.split(',');
                                if (propName.indexOf("cm:categories") != -1)
                                {
                                    catQuery = processDefaultCategoryProperty(cats, useSubCats);
                                }
                                else
                                {
                                    catQuery = processCustomCategoryProperty(propName, cats, useSubCats);
                                }

                                if (catQuery.length !== 0)
                                {
                                    // surround category terms with brackets if appropriate
                                    formQuery += (first ? '' : ' AND ') + "(" + catQuery + ")";
                                    first = false;
                                }
                            }
                        }
                        else if (isMultiValueProperty(propValue, modePropValue) || isListProperty(formJson, p))
                        {
                            if(propName.indexOf('isListProperty') === -1)
                            {
                                formQuery += (first ? '(' : ' AND (');
                                formQuery += processMultiValue(propName, propValue, modePropValue, false);
                                formQuery += ')';
                                first = false;
                            }
                        }
                        else
                        {
                            if (propValue.charAt(0) === '"' && propValue.charAt(propValue.length-1) === '"')
                            {
                                formQuery += (first ? '' : ' AND ') + escapeQName(propName) + ':' + propValue;
                            }
                            else
                            {
                                var index = propValue.lastIndexOf(" ");
                                formQuery += (first ? '' : ' AND ') + escapeQName(propName)
                                if (index > 0 && index < propValue.length - 1)
                                {
                                    formQuery += ':(' + propValue + ')';
                                }
                                else
                                {
                                    formQuery += ':"' + propValue + '"';
                                }
                            }
                            first = false;
                        }
                    }
                    else
                    {
                        if (isMultiValueProperty(propValue, modePropValue))
                        {
                            // multi-valued pseudo cm:content property - e.g. mimetype, size or encoding
                            formQuery += (first ? '(' : ' AND (');
                            formQuery += processMultiValue(propName, propValue, modePropValue, true);
                            formQuery += ')';
                        }
                        else
                        {
                            // single pseudo cm:content property - e.g. mimetype, size or encoding
                            formQuery += (first ? '' : ' AND ') + 'cm:content.' + propName + ':"' + propValue + '"';
                        }
                        first = false;
                    }
                }
                
                if (p == 'folders' && propValue != null && propValue.length > 0) {
                    var folders = [];
                    for (var i = 0, len = propValue.length; i < len ; i++) {
                        if (propValue[i] != null && propValue[i].length > 0) {
                            var pair = propValue[i].split('|');
                            if (pair[0].indexOf("alfresco://") == 0) {
                                if (pair[0] == "alfresco://company/shared") {
                                    folders.push("/app:company_home/app:shared");
                                }
                                if (pair[0] == "alfresco://user/home") {
                                    folders.push(userhome.qnamePath);
                                }
                            } else {
                                var node = search.findNode(pair[0]);
                                if (node != null) {
                                    folders.push(node.qnamePath);
                                    if (logger.isLoggingEnabled()) {
                                        logger.log("Query: Folder Path =====> " + node.qnamePath);
                                    }
                                }
                            }
                        }
                    }
                    if (folders != null && folders.length != 0) {
                        var foldersQuery = '';
                        for (var i = 0, len= folders.length ; i < len ; i++) {
                            var folder =  folders[i];
                            foldersQuery += 'PATH:"' + folder + '//*"';
                            if (i != len - 1) {
                                foldersQuery += ' OR ';
                            }
                        }
                        if (logger.isLoggingEnabled())
                            logger.log("Folder Query String: " + foldersQuery);

                        formQuery += formQuery.length !== 0 ? ' AND (' + foldersQuery + ')' : foldersQuery;

                        if (logger.isLoggingEnabled())
                            logger.log("Form Query String: " + formQuery);

                    } else {
                        if (logger.isLoggingEnabled())
                            logger.log("No Folder Query");
                    }                    
                }
            }
        }

        if (formQuery.length !== 0 || ftsQuery.length !== 0)
        {
            // extract data type for this search - advanced search query is type specific
            ftsQuery = formJson.datatype != null && formJson.datatype.length !== 0 ? 'TYPE:"' + formJson.datatype + '"' : '' +
                (formQuery.length !== 0 ? ' AND (' + formQuery + ')' : '') +
                (ftsQuery.length !== 0 ? ' AND (' + ftsQuery + ')' : '');
        }
    }

    if (ftsQuery.length !== 0)
    {
        // Filter queries
        var fqs = [];
        if (params.filters != null)
        {
            var filters = [];
            if(params.encodedFilters)
            {
                var encodedFilters = params.encodedFilters.split(",");
                for(var i=0; i<encodedFilters.length;i++)
                {
                    encodedFilters[i] = decodeURIComponent(encodedFilters[i]);
                    filters.push(encodedFilters[i]);
                }
            }
            else
            {
                // comma separated list of filter pairs - filter|value|value|...
                var filters = params.filters.split(",");
            }
            for (var f=0; f<filters.length; f++)
            {
                var filterParts = filters[f].split("|");
                if (filterParts.length > 1)
                {
                    // special case for some filters e.g. TYPE content or folder
                    switch (filterParts[0])
                    {
                        case "TYPE":
                        {
                            ftsQuery += ' AND +TYPE:"' + filterParts[1] + '"';
                            break;
                        }
                        default:
                        {
                            // facet filtering selection - reduce query results
                            // bracket each filter part within the attribute statement
                            ftsQuery += ' AND (' + filterParts[0] + ':(';
                            for (var p=1; p<filterParts.length; p++)
                            {
                                ftsQuery += '"' + filterParts[p] + '" ';  // space separated values
                            }
                            ftsQuery += '))';
                            break;
                        }
                    }
                }
            }
        }

        // ensure a TYPE is specified - if no add one to remove system objects from result sets
        if (ftsQuery.indexOf("TYPE:\"") === -1 && ftsQuery.indexOf("TYPE:'") === -1)
        {
            fqs.push('+TYPE:"cm:content" OR +TYPE:"cm:folder"');
        }

        // we processed the search terms, so suffix the PATH query
        var path = null;
        var site = null
        if (!params.repo)
        {
            if (params.siteId !== null && params.siteId.length > 0 )
            {
                if (params.containerId !== null && params.containerId.length > 0)
                {
                    // using PATH to restrict to container and site
                    path = SITES_SPACE_QNAME_PATH;
                    path += "cm:" + search.ISO9075Encode(params.siteId) + "/";
                    path += "cm:" + search.ISO9075Encode(params.containerId) + "/";
                }
                else
                {
                    // use SITE syntax to restrict to specific site
                    site = "SITE:\"" + params.siteId + "\"" ;
                }
            }
            else
            {
                if (params.containerId !== null && params.containerId.length > 0)
                {
                    // using PATH to restrict to container and site
                    path = SITES_SPACE_QNAME_PATH;
                    path += "*/";
                    path += "cm:" + search.ISO9075Encode(params.containerId) + "/";
                }
                else
                {
                    // use SITE syntax to restrict to specific site
                    site = "SITE:\"_ALL_SITES_\"" ;
                }
            }
        }

        // root node - generally used for overridden Repository root in Share
        if (params.repo && rootNode !== null)
        {
            ftsQuery = 'PATH:"' + rootNode.qnamePath + '//*" AND (' + ftsQuery + ')';
        }
        else if (path !== null)
        {
            fqs.push('PATH:"' + path + '/*"');
        }
        else if (site !== null)
        {
            fqs.push(site);
        }

        // Extensions
        /*
        var foldersParam = params.folders;
        if (foldersParam != null && foldersParam.length != 0) {
            if (logger.isLoggingEnabled())
                logger.log("Folder Param: " + foldersParam);
            var folderJson = jsonUtils.toObject(foldersParam);
            var folders = folderJson["folders"];
            var foldersQuery = '';
            for (var i = 0, len= folders.length ; i < len ; i++) {
                var folder =  folders[i];
                foldersQuery += 'PATH:"' + folder + '//*"';
                if (i != len - 1) {
                    foldersQuery += ' OR ';
                }
            }
            if (logger.isLoggingEnabled())
                logger.log("Folder Query String: " + foldersQuery);
            fqs.push(foldersQuery);
        } else {
            if (logger.isLoggingEnabled())
                logger.log("No Folder Query");
        }
        */
        // End

        fqs.push('-TYPE:"cm:thumbnail" AND -TYPE:"cm:failedThumbnail" AND -TYPE:"cm:rating" AND -TYPE:"st:site"' +
            ' AND -ASPECT:"st:siteContainer" AND -ASPECT:"sys:hidden" AND -cm:creator:system AND -QNAME:comment\\-*');


        // sort field - expecting field to in one of the following formats:
        //  - short QName form such as: cm:name
        //  - pseudo cm:content field starting with "." such as: .size
        //  - any other directly supported search field such as: TYPE
        var sortColumns = [];
        var sort = params.sort;
        if (sort != null && sort.length != 0)
        {
            var asc = true;
            var separator = sort.indexOf("|");
            if (separator != -1)
            {
                asc = (sort.substring(separator + 1) == "true");
                sort = sort.substring(0, separator);
            }
            var column;
            if (sort.charAt(0) == '.')
            {
                // handle pseudo cm:content fields
                column = "@{http://www.alfresco.org/model/content/1.0}content" + sort;
            }
            else if (sort.indexOf(":") != -1)
            {
                // handle attribute field sort
                column = "@" + utils.longQName(sort);
            }
            else
            {
                // other sort types e.g. TYPE
                column = sort;
            }
            sortColumns.push(
                {
                    column: column,
                    ascending: asc
                });
        }

        if (logger.isLoggingEnabled())
            logger.log("Query:\r\n" + ftsQuery + "\r\nSortby: " + (sort != null ? sort : ""));

        // perform fts-alfresco language query
        var qt = getQueryTemplate();
        var queryDef = {
            query: ftsQuery,
            language: "fts-alfresco",
            page: {
                maxItems: params.maxResults > 0 ? params.maxResults + 1 : params.pageSize,
                skipCount: params.maxResults > 0 ? 0 : params.startIndex
            },
            templates: qt.template,
            defaultField: "keywords",
            defaultOperator: qt.operator,
            onerror: "no-results",
            sort: sortColumns,
            fieldFacets: params.facetFields != null ? params.facetFields.split(",") : null,
            filterQueries: fqs,
            searchTerm: params.term,
            spellCheck: params.spell
        };
        var rs = search.queryResultSet(queryDef);
        nodes = rs.nodes;
    }
    else
    {
        // failed to process the search string - empty list returned
        var rs = {};
        nodes = [];
    }

    if (params.maxResults > 0)
    {
        return processResults(
            nodes,
            params.maxResults,
            params.startIndex,
            rootNode,
            rs.meta);
    }
    else
    {
        return processResultsSinglePage(
            nodes,
            params.startIndex,
            rootNode,
            rs.meta);
    }
}