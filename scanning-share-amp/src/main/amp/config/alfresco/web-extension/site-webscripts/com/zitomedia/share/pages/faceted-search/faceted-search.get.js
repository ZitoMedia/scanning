<import resource="classpath:/alfresco/templates/org/alfresco/import/alfresco-util.js">

var main = widgetUtils.findObject(model.jsonModel, "id", "FCTSRCH_MAIN_VERTICAL_STACK");
if (main != null) {
    /*
    var node = AlfrescoUtil.getNodeDetails("workspace://SpacesStore/e0856836-ed5e-4eee-b8e5-bd7e8fb9384c");
    var selectedNode = node.item.node;
    selectedNode.name = node.item.location.file;
    selectedNode.path = node.item.location.path + "/" + selectedNode.name;

    main.config.widgets.splice(3, 0, {
        id: "FCTSRCH_TOP_MENU_BAR_FOLDER_PICKER",
        name: "alfresco/forms/controls/ScanningContainerPicker",
        config: {
            name: "folders",
            label: "faceted-search.folder.label",
            description: "faceted-search.folder.label.description",
            useHash : true,
            requirementConfig: {
                initialValue: false
            },
            useCurrentItemAsValue : true,
            currentItem: [selectedNode]
        }
    });
    */
    main.config.widgets.splice(3, 0, {
        id: "FCTSRCH_TOP_MENU_BAR_FOLDER_PICKER",
        name: "alfresco/forms/controls/ScanningContainerPicker",
        config: {
            name: "folders",
            label: "faceted-search.folder.label",
            description: "faceted-search.folder.label.description",
            useHash : true,
            requirementConfig: {
                initialValue: false
            }
        }
    });
}

var searchDocLib = widgetUtils.findObject(model.jsonModel, "id", "FCTSRCH_SEARCH_RESULTS_LIST");
if (searchDocLib != null) {
    searchDocLib.name = "alfresco/search/ScanningAlfSearchList";
}
