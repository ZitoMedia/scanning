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
 * <p>Extends the standard [picker form control]{@link module:alfresco/forms/controls/Picker} to allow the user to select containers
 * (essentially folders) from the Alfresco repository.</p>
 *
 * <p>TODO: Update so that this is configurable for only selecting containers the user has write permission on</p>
 *
 * @module alfresco/forms/controls/ScanningContainerPicker
 * @extends module:alfresco/forms/controls/ContainerPicker
 * @mixes module:alfresco/core/CoreWidgetProcessing
 * @author Yong Qu
 */
define(["dojo/_base/declare",
        "alfresco/forms/controls/ContainerPicker",
        "alfresco/util/hashUtils",
        "dojo/io-query"],
    function (declare, ContainerPicker, hashUtils, ioQuery) {

        return declare([ContainerPicker], {
            startup: function alfresco_forms_controls_Picker__startup() {
                this.inherited(arguments);
                if (this.useCurrentItemAsValue && this.currentItem) {
                    var newValue = this.currentItem instanceof Array ? this.currentItem : [this.currentItem];
                    this.setValue(newValue);
                }
                if (this.useHash === true) {
                    var currHash = hashUtils.getHash();
                    var hashFolders = currHash.folders;
                    var folders = hashFolders != null && hashFolders.length > 0 ? hashFolders.split(',') : [];

                    var pickedItems = [];
                    for (var i = 0, len = folders.length; i < len; i++) {
                        var pickedItem = {};
                        var pair = folders[i].split('|');
                        pickedItem.nodeRef = pair[0];
                        pickedItem.name = pair.length > 1 ? pair[1] : "Unknown";
                        pickedItems.push(pickedItem);
                    }
                    this.setValue(pickedItems);
                }    
            },
            
            processPickedItems: function alfresco_forms_controls_Picker__processPickedItems(pickedItems) {
                if (pickedItems) {
                    var pickedItemsWidget = this.getPickedItemsWidget();
                    pickedItemsWidget.currentData.items = pickedItems;
                    pickedItemsWidget.renderView(false);
                    this.updateFormDialogButton(pickedItems);
                    if (this.useHash === true) {
                        var currHash = hashUtils.getHash();
                        var folders = currHash.folders;

                        var selectedFolders = "";
                        for (var i = 0, len = pickedItems.length; i < len; i++) {
                            selectedFolders += pickedItems[i].nodeRef + "|" + pickedItems[i].name;
                            if (i != len - 1) {
                                selectedFolders += ","
                            }
                        }

                        if (folders != selectedFolders) {
                            currHash.folders = selectedFolders;
                            this.alfPublish("ALF_NAVIGATE_TO_PAGE", {
                                url: ioQuery.objectToQuery(currHash),
                                type: "HASH"
                            }, true);
                        }
                    }
                }
                else {
                    this.alfLog("warn", "No items provided to assign to PickedItems widget, nothing will be set", this);
                }
                this.validate();
            }
        });
    });