/**
 * Copyright (C) 2005-2016 Alfresco Software Limited.
 *
 * This file is part of Alfresco
 *
 * Alfresco is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Alfresco is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Alfresco. If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Extends the [sortable paginated list]{@link module:alfresco/search/AlfSearchList} to
 * handle search specific data.
 *
 * @module zitomedia/search/ScanningAlfSearchList
 * @extends alfresco/search/AlfSearchList
 * @author Yong Qu
 */
define(["dojo/_base/declare",
        "alfresco/search/AlfSearchList",
        "alfresco/core/topics",
        "dojo/_base/array",
        "dojo/_base/lang",
        "dojo/dom-class",
        "alfresco/util/hashUtils",
        "dojo/io-query",
        "alfresco/core/ArrayUtils",
        "alfresco/core/ObjectTypeUtils",
        "alfresco/search/AlfSearchListView"],
        function(declare, AlfSearchList, topics, array, lang, domClass, hashUtils, ioQuery, arrayUtils, ObjectTypeUtils) {

   return declare([AlfSearchList], {
      /**
       * Processes all the current search arguments into a payload that is published to the [Search Service]{@link module:alfresco/services/SearchService}
       * to perform the actual search request
       *
       * @instance
       */
      loadData: function alfresco_search_AlfSearchList__loadData() {
         // jshint maxcomplexity:false,maxstatements:false
         
         // Ensure any no data node is hidden...
         domClass.add(this.noDataNode, "share-hidden");

         var key;
         if (this.requestInProgress)
         {
            // TODO: Inform user that request is in progress?
            this.alfLog("log", "Search request ignored because progress is already in progress");
            this._searchPending = true;
         }
         else
         {
            if (this.currentRequestId)
            {
                this.alfPublish("ALF_STOP_SEARCH_REQUEST", {
                   requestId: this.currentRequestId
                }, true);
            }

            // InfiniteScroll uses pagination under the covers.
            var startIndex = (this.currentPage - 1) * this.currentPageSize;
            if (!this.useInfiniteScroll ||
                !this.currentData ||
                this.currentData.numberFound === -1 || // Indicate no results found on previous search
                this.currentData.numberFound >= startIndex)
            {
               this.alfPublish(this.requestInProgressTopic, {});
               this.showLoadingMessage();

               // When loading a page containing filters to apply as a URL hash parameter, the facetFilters attribute
               // will be a string, but when applied after the page is loaded it will be an object. We need to treat
               // each case differently...
               var filters = "";
               if (ObjectTypeUtils.isString(this.facetFilters))
               {
                  // When facetFilters is a string it will be delimited by commas, the string can be split to get an array
                  // of each filter to apply...
                  var filtersArray = this.facetFilters.split(",");
                  array.forEach(filtersArray, function(filter) {
                     filters = filters + filter.replace(/\.__.u/g, "").replace(/\.__/g, "") + ",";
                  });
               }
               else
               {
                  // When facetFilters is an object, each key will be a filter to be applied...
                  for (key in this.facetFilters)
                  {
                     if (this.facetFilters.hasOwnProperty(key))
                     {
                        filters = filters + key.replace(/\.__.u/g, "").replace(/\.__/g, "") + ",";
                     }
                  }
               }
               // Trim any trailing comma...
               filters = filters.substring(0, filters.length - 1);

               // Make sure the repo param is set appropriately...
               // The repo instance variable trumps everything else...
               var siteId = this.siteId;
               var scope = this.selectedScope;
               if (this.useHash === true)
               {
                  // Unfortunately we made the error of using "scope" on the URL hash and
                  // "selectedScope" as the widget attribute. This means that we have to special
                  // case useHash being set to true to use the appropriate value for the mode being used...
                  siteId = (this.scope === "repo" || this.scope === "all_sites") ? "" : scope;
                  scope = this.scope || scope.toLowerCase();
               }
               
               this.currentRequestId = this.generateUuid();
               var searchPayload = {
                  term: this.searchTerm,
                  facetFields: this.facetFields,
                  filters: filters,
                  sortAscending: this.sortAscending,
                  sortField: this.sortField,
                  site: siteId,
                  rootNode: this.rootNode,
                  repo: scope === "repo",
                  requestId: this.currentRequestId,
                  pageSize: this.currentPageSize,
                  maxResults: 0,
                  startIndex: startIndex,
                  folders: this.folders,
                  spellcheck: this.spellcheck && !this._suspendSpellCheck
               };

               var currHash = hashUtils.getHash();
               if (currHash.folders != null) {
                  searchPayload.folders = currHash.folders.split(',');
               }

               if (this.query)
               {
                  this.alfCleanFrameworkAttributes(this.query, true);

                  if(typeof this.query === "string")
                  {
                     this.query = JSON.parse(this.query);
                  }

                  for (key in this.query)
                  {
                     if (this.query.hasOwnProperty(key))
                     {
                        searchPayload[key] = this.query[key];
                     }
                  }
               }

               // Set a response topic that is scoped to this widget...
               searchPayload.alfResponseTopic = this.pubSubScope + "ALF_RETRIEVE_DOCUMENTS_REQUEST";
               this.alfPublish(topics.SEARCH_REQUEST, searchPayload, true);
            }
            else
            {
               this.alfLog("log", "No more data to to retrieve, cancelling search request", this);
            }
         }
      }
   });
});