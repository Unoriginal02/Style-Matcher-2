figma.showUI(__html__, { width: 768, height: 600 });

//Parent Counter
function getNodeToAppend(node: any): any {
  let parentsN = 0;

  let _lastNode = node.parent;
  while (_lastNode != null) {
    parentsN++;
    _lastNode = _lastNode.parent;
  }

  let object = {
    id: node.id,
    name: node.name,
    parentsN,
  };
  return object;
}

// Dont' know Yet
let currentNodeIndex = 0;

figma.ui.onmessage = (msg) => {
  // Copied notification
  if (msg.type === 'notify') {
    figma.notify('Copied!');
  }

  function isMixed(styleId: string | symbol) {
    return styleId === figma.mixed;
  }

  // Helper function to convert RGBA to hex string
  function rgbaToHex(color: RGBA): string {
    const r = (Math.round(color.r * 255).toString(16).length === 1 ? '0' : '') + Math.round(color.r * 255).toString(16);
    const g = (Math.round(color.g * 255).toString(16).length === 1 ? '0' : '') + Math.round(color.g * 255).toString(16);
    const b = (Math.round(color.b * 255).toString(16).length === 1 ? '0' : '') + Math.round(color.b * 255).toString(16);
    return `#${r}${g}${b}`;
  }

  // Helper function to convert hex string to RGBA
  function hexToRgba(hex: string): RGBA {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255.0,
      g: parseInt(result[2], 16) / 255.0,
      b: parseInt(result[3], 16) / 255.0,
      a: 1
    } : { r: 0, g: 0, b: 0, a: 1 };
  }

  // Helper function to check if an object is of type RGBA
  function isRgba(obj: any): obj is RGBA {
    return obj && typeof obj.r === 'number' && typeof obj.g === 'number' && typeof obj.b === 'number' && typeof obj.a === 'number';
  }

  function isSceneNode(node: BaseNode): node is SceneNode {
    return "parent" in node;
  }


  // This function traverses a FrameNode and identifies nodes with applied color styles and nodes without
  function findColorStyles(group: FrameNode, msg: string): { colorStyles: { name: string; nodes: any[]; isRemote: boolean; styleType: string }[]; noColorStyles: { name: string; nodes: any[]; styleType: string }[]; boundVariables: { name: string; hexColor: string; nodes: any[]; styleType: string;  modeName: string  }[]; } {
    console.log("findColorStyles recieved:", msg);

    // Initialize arrays to hold nodes with and without color styles
    const colorStyles: { name: string; hexColor: string; nodes: any[]; isRemote: boolean; styleType: string }[] = [];
    const noColorStyles: { name: string; hexColor: string; nodes: any[]; styleType: string }[] = [];
    const boundVariables: { name: string; hexColor: string; nodes: any[]; isRemote: boolean; styleType: string;  modeName: string }[] = [];
    const visitedNodes = new Set<string>();

    // Type guard to check if styleId is a string
    function isStyleIdString(styleId: string | typeof figma.mixed): styleId is string {
      return typeof styleId === "string";
    }

    // Recursive function to search for color styles in the children of a node
    function searchColorStyles(node: BaseNode): void {
      if (node.type !== "INSTANCE") {
        if ("fills" in node && Array.isArray(node.fills) && node.fills.length > 0) {
          const fill = node.fills[0];
          if (fill.type === "SOLID") {
            if (node.boundVariables?.['fills']) {
              // Process bound variables for fills
              node.boundVariables?.['fills'].forEach(variableAlias => {
                const fillVariableId = variableAlias.id;
                processBoundVariables(node, fillVariableId, "fill");
              });
            } else {
              processColorStyles(node, fill.color, isStyleIdString(node.fillStyleId) ? node.fillStyleId : null, "fill");
            }
          }
        }

        if ("strokes" in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
          const stroke = node.strokes[0];
          if (stroke.type === "SOLID") {
            if (node.boundVariables?.['strokes']) {
              // Process bound variables for strokes
              node.boundVariables?.['strokes'].forEach(variableAlias => {
                const fillVariableId = variableAlias.id;
                processBoundVariables(node, fillVariableId, "stroke");
              });
            } else {
              processColorStyles(node, stroke.color, isStyleIdString(node.strokeStyleId) ? node.strokeStyleId : null, "stroke");
            }
          }
        }

        if ("children" in node) {
          for (const child of node.children) {
            searchColorStyles(child);
          }
        }
      }
    }

    function searchAllColorStyles(node: SceneNode): void {
      console.log("GetAllStyles function message triggered");
      // Skip processing hidden nodes
      if (!node.visible) {
        return;
      }
      // console.log('Processing node:', node.id, node.type);
      if (visitedNodes.has(node.id)) {
        // console.log('Skipping node:', node.id);
        return;
      }
      visitedNodes.add(node.id);

      if ("fills" in node && Array.isArray(node.fills) && node.fills.length > 0) {
        const fill = node.fills[0];
        if (fill.type === "SOLID") {
          if (node.boundVariables?.['fills']) {
            // Process bound variables for fills
            node.boundVariables?.['fills'].forEach(variableAlias => {
              const fillVariableId = variableAlias.id;
              processBoundVariables(node, fillVariableId, "fill");
            });
          } else {
            processColorStyles(node, fill.color, isStyleIdString(node.fillStyleId) ? node.fillStyleId : null, "fill");
          }
        }
      }

      if ("strokes" in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
        const stroke = node.strokes[0];
        if (stroke.type === "SOLID") {
          if (node.boundVariables?.['strokes']) {
            // Process bound variables for strokes
            node.boundVariables?.['strokes'].forEach(variableAlias => {
              const fillVariableId = variableAlias.id;
              processBoundVariables(node, fillVariableId, "stroke");
            });
          } else {
            processColorStyles(node, stroke.color, isStyleIdString(node.strokeStyleId) ? node.strokeStyleId : null, "stroke");
          }
        }
      }

      if ("children" in node) {
        for (const child of node.children) {
          searchAllColorStyles(child);
        }
      }
    }

    // Function to process color styles - adds nodes to either colorStyles or noColorStyles array
    function processColorStyles(node: BaseNode, color: RGBA, styleId: string | null, styleType: string) {
      const hexColor = rgbaToHex(color);
      if (styleId && typeof styleId === "string") {
        const paintStyle = figma.getStyleById(styleId);

        if (paintStyle) {
          const existingStyle = colorStyles.find((style) => style.name === paintStyle.name && style.styleType === styleType);
          if (existingStyle) {
            existingStyle.nodes.push(getNodeToAppend(node));
          } else {
            colorStyles.push({ name: paintStyle.name, hexColor, nodes: [getNodeToAppend(node)], isRemote: paintStyle.remote, styleType });
          }
        }
      } else {
        const existingStyle = noColorStyles.find((style) => style.name === hexColor && style.styleType === styleType);
        if (existingStyle) {
          existingStyle.nodes.push(getNodeToAppend(node));
        } else {
          noColorStyles.push({ name: hexColor, hexColor, nodes: [getNodeToAppend(node)], styleType });
        }
      }
    }

    function processBoundVariables(node: BaseNode, variableId: string, styleType: string) {
      const variable = figma.variables.getVariableById(variableId);
    
      if (isSceneNode(node)) {
        if (variable !== null) {
          const variableValue = variable.resolveForConsumer(node).value;
    
          let rgbaColor: RGBA;
    
          if (typeof variableValue === 'string') {
            rgbaColor = hexToRgba(variableValue);
          } else if (isRgba(variableValue)) {
            rgbaColor = variableValue;
          } else {
            throw new Error('Unsupported color format');
          }
    
          const hexColor = rgbaToHex(rgbaColor);
    
          let modeName = '';
    
          // Log the variable collection IDs and their corresponding modes
          if ("explicitVariableModes" in node) {
            const explicitVariableModes = node.explicitVariableModes;
            for (const variableCollectionId in explicitVariableModes) {
              const modeId = explicitVariableModes[variableCollectionId];
    
              // Get the VariableCollection object
              const variableCollection = figma.variables.getVariableCollectionById(variableCollectionId);
    
              // Null check for variableCollection
              if (variableCollection) {
                // Find the mode with the matching ID
                const mode = variableCollection.modes.find(m => m.modeId === modeId);
    
                if (mode) {
                  modeName = mode.name;
                  console.log(`Variable Collection ID: ${variableCollectionId}, Mode ID: ${modeId}, Mode Name: ${mode.name}`);
                } else {
                  console.log(`Variable Collection ID: ${variableCollectionId}, Mode ID: ${modeId}, Mode Name: Not found`);
                }
              } else {
                console.log(`Variable Collection with ID ${variableCollectionId} is null`);
              }
            }
          }
    
          const existingVariable = boundVariables.find(
            (entry) =>
              entry.name === variable.name &&
              entry.hexColor === hexColor &&
              entry.styleType === styleType
          );
          if (existingVariable) {
            existingVariable.nodes.push(getNodeToAppend(node));
          } else {
            boundVariables.push({
              name: variable.name,
              hexColor,
              nodes: [getNodeToAppend(node)],
              isRemote: variable.remote,
              styleType,
              modeName // Adding modeName to the array
            });

          }
    
        } else {
          console.log('Variable is null');
        }
      } else {
        console.log('Node is not a SceneNode');
      }
    }
    

    // Start the color style search in the group
    if (msg === "getStyles" || msg === "refresh") {
      searchColorStyles(group);
    } else if (msg === "getAllStyles") {
      searchAllColorStyles(group as SceneNode);
    }
    // console.log("boundVariables:",boundVariables);
    // console.log("colorStyles:",colorStyles);
    // console.log("noColorStyles:",noColorStyles);

    // Return the results - color styles and no color styles

    // Filter the noColorStyles array to exclude styles that exist in the boundVariables array
    const filteredNoColorStyles = noColorStyles.filter(noColorStyle => {
      return !boundVariables.some(boundVariable => {
        return boundVariable.name === noColorStyle.name && boundVariable.styleType === noColorStyle.styleType;
      });
    });

    console.log("Find colors results:", colorStyles, filteredNoColorStyles, boundVariables);

    return { colorStyles, noColorStyles: filteredNoColorStyles, boundVariables };

  }

  // This function traverses a FrameNode and identifies nodes with applied font styles and nodes without
  function findFontStyles(group: FrameNode, msg: string): { fontStyles: { name: string; nodes: any[] }[]; noFontStyles: { name: string; nodes: any[] }[] } {
    console.log("findFontStyles messages received:", msg);
    // Initialize arrays to hold nodes with and without font styles
    const fontStyles: { name: string; nodes: any[]; isRemote: boolean }[] = [];
    const noFontStyles: { name: string; nodes: any[] }[] = [];

    // Recursive function to search for font styles in the children of a node
    function searchFontStyles(node: BaseNode): void {
      // Ignore instances
      if (node.type !== "INSTANCE") {
        // Check if node is of type TEXT and has a fontName property
        if (node.type === "TEXT" && node.fontName && typeof node.fontName === "object") {
          let fontStyleName = "";

          // If the node has a textStyleId, attempt to find the corresponding style
          if (node.textStyleId && typeof node.textStyleId === "string") {
            const textStyle = figma.getStyleById(node.textStyleId);
            if (textStyle) {
              fontStyleName = textStyle.name;
              const existingStyle = fontStyles.find((style) => style.name === fontStyleName);
              // If the style already exists in the fontStyles array, add the node to its nodes array
              if (existingStyle) {
                existingStyle.nodes.push(getNodeToAppend(node));
              } else {
                // If the style does not exist, add a new style to the fontStyles array
                fontStyles.push({ name: fontStyleName, nodes: [getNodeToAppend(node)], isRemote: textStyle.remote });
              }
            }
          } else {
            // If the node does not have a textStyleId, use the fontName and fontSize to create a style name
            fontStyleName = `${node.fontName.family} ${node.fontName.style}`;
            if (node.fontSize) {
              fontStyleName += ` - ${String(node.fontSize)}px`;
            }

            const existingStyle = noFontStyles.find((style) => style.name === fontStyleName);
            // If the style already exists in the noFontStyles array, add the node to its nodes array
            if (existingStyle) {
              existingStyle.nodes.push(getNodeToAppend(node));
            } else {
              // If the style does not exist, add a new style to the noFontStyles array
              noFontStyles.push({ name: fontStyleName, nodes: [getNodeToAppend(node)] });
            }
          }
        }

        // If the node has children, recursively search the children
        if ("children" in node) {
          for (const child of node.children) {
            searchFontStyles(child);
          }
        }
      }
    }

    // Recursive function to search for font styles in the children of a node
    function searchAllFontStyles(node: BaseNode): void {
      console.log("searchAllFontStyles function triggered");

      if (
        node.type === "TEXT" &&
        node.fontName &&
        typeof node.fontName === "object"
      ) {
        let fontStyleName = "";

        if (node.textStyleId && typeof node.textStyleId === "string") {
          const textStyle = figma.getStyleById(node.textStyleId);
          if (textStyle) {
            fontStyleName = textStyle.name;
            const existingStyle = fontStyles.find((style) => style.name === fontStyleName);
            if (existingStyle) {
              existingStyle.nodes.push(getNodeToAppend(node));
            } else {
              fontStyles.push({ name: fontStyleName, nodes: [getNodeToAppend(node)], isRemote: textStyle.remote });
            }
          }
        } else {
          fontStyleName = `${node.fontName.family} ${node.fontName.style}`;
          if (node.fontSize) {
            fontStyleName += ` - ${String(node.fontSize)}px`;
          }

          const existingStyle = noFontStyles.find((style) => style.name === fontStyleName);
          if (existingStyle) {
            existingStyle.nodes.push(getNodeToAppend(node));
          } else {
            noFontStyles.push({ name: fontStyleName, nodes: [getNodeToAppend(node)] });
          }
        }
      }

      if ("children" in node) {
        for (const child of node.children) {
          searchAllFontStyles(child);
        }
      }

    }

    // Start the font style search in the group
    if (msg === "getStyles" || msg === "refresh") {
      searchFontStyles(group);
    } else if (msg === "getAllStyles") {
      searchAllFontStyles(group);
    }

    console.log("fontStyles result:", fontStyles, noFontStyles);

    // Return the results - font styles and no font styles
    return { fontStyles, noFontStyles };
  }

  // Code to execute when a message of type 'getStyles' is received
  if (msg.type === 'getStyles' || msg.type === 'getAllStyles') {
    const selection = figma.currentPage.selection;

    // 1- Take the current selection (one or multiple objects)
    if (selection.length > 0) {
      // 2- Check if the selection is not already an autolayout group called "Matcher Workbench"
      const groupName = "Matcher Workbench";
      let group: FrameNode;

      // If there's only one selection, and it's a FrameNode with name "Matcher Workbench", use it as the group
      if (selection.length === 1 && selection[0].type === 'FRAME' && selection[0].name === groupName) {
        group = selection[0] as FrameNode;
      } else {
        // If not, create a new group to encompass all selected items

        // Calculate the bounding box of the selected items
        let minX = Infinity;
        let minY = Infinity;

        // Calculate the smallest X and Y coordinates from the selected objects
        for (const node of selection) {
          const nodeBounds = node.absoluteTransform;
          minX = Math.min(minX, nodeBounds[0][2]);
          minY = Math.min(minY, nodeBounds[1][2]);
        }

        // Create a new FrameNode to serve as the group
        group = figma.createFrame();
        group.name = groupName;
        group.layoutMode = "VERTICAL";
        group.primaryAxisSizingMode = "AUTO";
        group.counterAxisSizingMode = "AUTO";
        group.horizontalPadding = 32;
        group.verticalPadding = 32;
        group.itemSpacing = 32;
        group.fills = [{ type: 'SOLID', color: { r: 0.99, g: 0.99, b: 0.99 } }];

        // Set the position of the new frame
        group.x = minX;
        group.y = minY;

        // Add the selected objects as children of the new frame
        for (const node of selection) {
          group.appendChild(node);
        }

        // Add the new frame to the current page
        figma.currentPage.appendChild(group);
        figma.currentPage.selection = [group];
      }

      // 3- Execute the function as is
      // Find the color and font styles used in the group
      const colorStylesResults = findColorStyles(group, msg.type);
      const fontStylesResults = findFontStyles(group, msg.type);

      // Extract the results from the return objects
      const variables = colorStylesResults.boundVariables;
      const colorStyles = colorStylesResults.colorStyles;
      const noColorStyles = colorStylesResults.noColorStyles;
      const fontStyles = fontStylesResults.fontStyles;
      const noFontStyles = fontStylesResults.noFontStyles;

      // console.log("Variables to send:",variables);
      // console.log("Color styles to send:",colorStyles);
      // console.log("No color styles to send:",noColorStyles);
      // console.log("Font styles to send:",fontStyles);
      // console.log("No font styles to send:",noFontStyles);

      // Send the gathered color styles and font styles to the UI (ui.html)
      figma.ui.postMessage({ type: 'variables', variables });
      figma.ui.postMessage({ type: 'colorStyles', styles: colorStyles });
      figma.ui.postMessage({ type: 'noColorStyles', styles: noColorStyles });
      figma.ui.postMessage({ type: 'fontStyles', styles: fontStyles });
      figma.ui.postMessage({ type: 'noFontStyles', styles: noFontStyles });

      // Uncomment the below to log the colorStyles and noColorStyles
      // console.log(colorStyles);
      // console.log(noColorStyles);
    } else {
      // If there is no selection, notify the user
      figma.notify('Please select something.');
    }
  }

  if (msg.type === 'refresh') {
    const groupName = "Matcher Workbench";
    const group = figma.currentPage.findOne(node => node.type === 'FRAME' && node.name === groupName) as FrameNode;

    if (group) {
      const colorStylesResults = findColorStyles(group, msg.type);
      const fontStylesResults = findFontStyles(group, msg.type);

      const variables = colorStylesResults.boundVariables;
      const colorStyles = colorStylesResults.colorStyles;
      const noColorStyles = colorStylesResults.noColorStyles;
      const fontStyles = fontStylesResults.fontStyles;
      const noFontStyles = fontStylesResults.noFontStyles;

      // Send the gathered color styles and font styles to the UI (ui.html)
      figma.ui.postMessage({ type: 'variables', variables });
      figma.ui.postMessage({ type: 'colorStyles', styles: colorStyles });
      figma.ui.postMessage({ type: 'noColorStyles', styles: noColorStyles });
      figma.ui.postMessage({ type: 'fontStyles', styles: fontStyles });
      figma.ui.postMessage({ type: 'noFontStyles', styles: noFontStyles });

      figma.notify('Styles refreshed!');
    } else {
      figma.notify('Matcher Workbench not found.');
    }
  }

  // Locate Object
  if (msg.type === "locateColorStyle" || msg.type === "locateFontStyle") {
    const nodes = msg.nodes;
    const nodesToSelect = nodes
      .map((node: any) => figma.getNodeById(node.id))
      .filter((node: BaseNode | null) => node !== null) as SceneNode[];

    if (nodesToSelect.length > 0) {
      figma.currentPage.selection = nodesToSelect;
      figma.viewport.scrollAndZoomIntoView(nodesToSelect);
      figma.notify(`${nodesToSelect.length} node(s) selected`);
    }
  }

  // Locate the next node
  if (msg.type === "locateNextNode") {
    const nodes = msg.nodes;
    const nodesArray = nodes
      .map((node: any) => figma.getNodeById(node.id))
      .filter((node: BaseNode | null) => node !== null) as SceneNode[];

    if (nodesArray.length > 0) {
      // Increment the currentNodeIndex, and wrap around if it exceeds the array length
      currentNodeIndex = (currentNodeIndex + 1) % nodesArray.length;

      // Select the next node
      const nextNode = nodesArray[currentNodeIndex];
      figma.currentPage.selection = [nextNode];
      figma.viewport.scrollAndZoomIntoView([nextNode]);
      // figma.notify(`Selected node ${currentNodeIndex + 1} of ${nodesArray.length}`);
    }
  }

  // Ungroup
  if (msg.type === 'ungroup') {
    const groupName = "Matcher Workbench";
    const group = figma.currentPage.findOne(node => node.type === 'FRAME' && node.name === groupName) as FrameNode;

    if (group) {
      const parent = group.parent;
      if (parent) {
        let currentY = group.y;

        for (const child of group.children) {
          parent.appendChild(child);
          child.x = group.x;
          child.y = currentY;
          currentY += child.height + 32; // Add 32px vertical separation
        }
        group.remove();
        figma.notify('Ungrouped successfully!');
      } else {
        figma.notify('Unable to ungroup. Group has no parent.');
      }
    } else {
      figma.notify('Matcher Workbench not found.');
    }
  }

  // Check if a node is a descendant of another node
  function isDescendant(parent: BaseNode, child: BaseNode): boolean {
    let currentNode = child.parent;
    while (currentNode !== null) {
      if (currentNode === parent) {
        return true;
      }
      currentNode = currentNode.parent;
    }
    return false;
  }

  // StyleNodes
  if (msg.type === 'styleNodes') {
    const nodes = msg.nodes;
    const ids = msg.ids;
    // console.log('Received nodes:', nodes, ids);

    // Check if nodeA is a descendant of nodeB
    function isDescendant(nodeA: BaseNode, nodeB: BaseNode): boolean {
      let currentNode = nodeA.parent;
      while (currentNode !== null) {
        if (currentNode === nodeB) {
          return true;
        }
        currentNode = currentNode.parent;
      }
      return false;
    }

    // Get parenting results for each node
    const parentingResults = nodes.map((nodeA: any) => {
      return nodes.some((nodeB: any) => {
        if (nodeA.id !== nodeB.id) {
          const nodeAObj = figma.getNodeById(nodeA.id);
          const nodeBObj = figma.getNodeById(nodeB.id);
          if (nodeAObj && nodeBObj) {
            return isDescendant(nodeAObj, nodeBObj);
          }
        }
        return false;
      });
    });

    // Calculate parentTotal based on parentingResults
    const parentTotal = parentingResults.some((result: boolean) => result === true);
    // console.log('parentTotal'+parentTotal);


    // Send the parenting results and parentTotal back with the ids
    figma.ui.postMessage({ type: 'parentingResults', ids: ids, parentTotal: parentTotal });
  }

  // This is the end
}