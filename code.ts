figma.showUI(__html__, { width: 640, height: 600 });

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

let currentNodeIndex = 0;

figma.ui.onmessage = (msg) => {
  if (msg.type === 'notify') {
    figma.notify('Copied!');
  }

  function isMixed(styleId: string | symbol) {
    return styleId === figma.mixed;
  }

  if (msg.type === 'applySelectedColorStyle') {
    const styleNodes = msg.nodes;
    const styleType = msg.styleType;
    const selection = figma.currentPage.selection;

    if (selection.length > 0) {
      const firstSelectedNode = selection[0];

      let selectedStyleId;

      if (styleType === 'fill' && 'fills' in firstSelectedNode && firstSelectedNode.fillStyleId && !isMixed(firstSelectedNode.fillStyleId)) {
        selectedStyleId = firstSelectedNode.fillStyleId;
      } else if (styleType === 'stroke' && 'strokes' in firstSelectedNode && firstSelectedNode.strokeStyleId && !isMixed(firstSelectedNode.strokeStyleId)) {
        selectedStyleId = firstSelectedNode.strokeStyleId;
      } else {
        // console.log('Selected object has no matching color style or has mixed styles');
        return;
      }

      const selectedStyle = figma.getStyleById(String(selectedStyleId));

      if (selectedStyle) {
        for (const node of styleNodes) {
          const targetNode = figma.getNodeById(node.id);
          if (targetNode) {
            if (styleType === 'fill' && 'fills' in targetNode) {
              targetNode.fillStyleId = selectedStyle.id;
            } else if (styleType === 'stroke' && 'strokes' in targetNode) {
              targetNode.strokeStyleId = selectedStyle.id;
            }
          }
        }
      }
    } else {
      // Handle the case when no object is selected
      // console.log('No object is selected');
    }
    figma.notify('Style applied to all nudes');
  }

  // Find Color Styles
  function findColorStyles(group: FrameNode): { colorStyles: { name: string; nodes: any[]; isRemote: boolean; styleType: string }[]; noColorStyles: { name: string; nodes: string[]; styleType: string }[] } {
    // Initialize two arrays: colorStyles for positive results and noColorStyles for negative results
    const colorStyles: { name: string; hexColor: string; nodes: any[]; isRemote: boolean; styleType: string }[] = [];
    const noColorStyles: { name: string; hexColor: string; nodes: any[]; styleType: string }[] = [];

    // Type guard function to check if the style ID is a string
    function isStyleIdString(styleId: string | typeof figma.mixed): styleId is string {
      return typeof styleId === "string";
    }

    // Helper function to convert RGBA to hex string
    function rgbaToHex(color: RGBA): string {
      const r = (Math.round(color.r * 255).toString(16).length === 1 ? '0' : '') + Math.round(color.r * 255).toString(16);
      const g = (Math.round(color.g * 255).toString(16).length === 1 ? '0' : '') + Math.round(color.g * 255).toString(16);
      const b = (Math.round(color.b * 255).toString(16).length === 1 ? '0' : '') + Math.round(color.b * 255).toString(16);
      return `#${r}${g}${b}`;
    }

    // Helper function to process color styles
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

    // Recursive function to search for color styles in the children of a node
    function searchColorStyles(node: BaseNode): void {
      if (node.type !== "INSTANCE") {
        if ("fills" in node && Array.isArray(node.fills) && node.fills.length > 0) {
          const fill = node.fills[0];
          if (fill.type === "SOLID") {
            processColorStyles(node, fill.color, isStyleIdString(node.fillStyleId) ? node.fillStyleId : null, "fill");
          }
        }

        if ("strokes" in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
          const stroke = node.strokes[0];
          if (stroke.type === "SOLID") {
            processColorStyles(node, stroke.color, isStyleIdString(node.strokeStyleId) ? node.strokeStyleId : null, "stroke");
          }
        }

        if ("children" in node) {
          for (const child of node.children) {
            searchColorStyles(child);
          }
        }
      }
    }

    // Start searching color styles in the group
    searchColorStyles(group);

    // Log the found color styles with their node IDs
    // console.log("Found color styles:", colorStyles);
    // console.log("Found no color styles:", noColorStyles);

    return { colorStyles, noColorStyles };
  }

  // Find Font Styles
  function findFontStyles(group: FrameNode): { fontStyles: { name: string; nodes: any[] }[]; noFontStyles: { name: string; nodes: any[] }[] } {
    // Initialize two arrays: fontStyles for positive results and noFontStyles for negative results
    const fontStyles: { name: string; nodes: any[]; isRemote: boolean }[] = [];
    const noFontStyles: { name: string; nodes: any[] }[] = [];

    // Recursive function to search for font styles in the children of a node
    function searchFontStyles(node: BaseNode): void {
      if (node.type !== "INSTANCE") {
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
            searchFontStyles(child);
          }
        }
      }
    }

    // Start searching font styles in the group
    searchFontStyles(group);

    // Log the found font styles with their node IDs
    // console.log("Found font styles:", fontStyles);
    // console.log("Found no font styles:", noFontStyles);

    return { fontStyles, noFontStyles };
  }

  // Find all Color Style
  function findAllColorStyles(group: FrameNode): { colorStyles: { name: string; hexColor: string; nodes: any[]; isRemote: boolean; styleType: string }[]; noColorStyles: { name: string; hexColor: string; nodes: any[]; styleType: string }[] } {
    const colorStyles: { name: string; hexColor: string; nodes: any[]; isRemote: boolean; styleType: string }[] = [];
    const noColorStyles: { name: string; hexColor: string; nodes: any[]; styleType: string }[] = [];
    const visitedNodes = new Set<string>();


    function isStyleIdString(styleId: string | typeof figma.mixed): styleId is string {
      return typeof styleId === "string";
    }

    function rgbaToHex(color: RGBA): string {
      const r = (Math.round(color.r * 255).toString(16).length === 1 ? '0' : '') + Math.round(color.r * 255).toString(16);
      const g = (Math.round(color.g * 255).toString(16).length === 1 ? '0' : '') + Math.round(color.g * 255).toString(16);
      const b = (Math.round(color.b * 255).toString(16).length === 1 ? '0' : '') + Math.round(color.b * 255).toString(16);
      return `#${r}${g}${b}`;
    }

    function processColorStyles(node: BaseNode, color: RGBA, styleId: string | null, styleType: string) {
      const hexColor = rgbaToHex(color);
      if (styleId && typeof styleId === "string") {
        const paintStyle = figma.getStyleById(styleId);
        if (paintStyle) {
          const existingStyle = colorStyles.find((style) => style.name === paintStyle.name && style.styleType === styleType);
          if (existingStyle) {
            existingStyle.nodes.push({ id: node.id, name: node.name });
          } else {
            colorStyles.push({ name: paintStyle.name, hexColor, nodes: [{ id: node.id, name: node.name }], isRemote: paintStyle.remote, styleType });
          }
        }
      } else {
        const existingStyle = noColorStyles.find((style) => style.name === hexColor && style.styleType === styleType);
        if (existingStyle) {
          existingStyle.nodes.push({ id: node.id, name: node.name });
        } else {
          noColorStyles.push({ name: hexColor, hexColor, nodes: [{ id: node.id, name: node.name }], styleType });
        }
      }
    }

    function searchAllColorStyles(node: SceneNode): void {
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
          processColorStyles(node, fill.color, isStyleIdString(node.fillStyleId) ? node.fillStyleId : null, "fill");
        }
      }

      if ("strokes" in node && Array.isArray(node.strokes
      ) && node.strokes.length > 0) {
        const stroke = node.strokes[0];
        if (stroke.type === "SOLID") {
          processColorStyles(node, stroke.color, isStyleIdString(node.strokeStyleId) ? node.strokeStyleId : null, "stroke");
        }
      }
      if ("children" in node) {
        for (const child of node.children) {
          searchAllColorStyles(child);
        }
      }

      if (node.type === "INSTANCE") {
        // console.log('Instance node:', node.id);
        if (node.mainComponent && "children" in node.mainComponent) {
          // No need to process the children of the mainComponent, as they are already processed as part of the instance
        }
      }
    }

    // console.log('Starting search in group:', group);
    // Start searching color styles in the group
    searchAllColorStyles(group as SceneNode);

    // console.log('Finished search');
    return { colorStyles, noColorStyles };
  }

  // Find All Font Styles
  function findAllFontStyles(group: FrameNode): { fontStyles: { name: string; nodes: any[] }[]; noFontStyles: { name: string; nodes: any[] }[] } {
    // Initialize two arrays: fontStyles for positive results and noFontStyles for negative results
    const fontStyles: { name: string; nodes: any[]; isRemote: boolean }[] = [];
    const noFontStyles: { name: string; nodes: any[] }[] = [];

    // Recursive function to search for font styles in the children of a node
    function searchFontStyles(node: BaseNode): void {

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
          searchFontStyles(child);
        }
      }

    }

    // Start searching font styles in the group
    searchFontStyles(group);

    // Log the found font styles with their node IDs
    // console.log("Found font styles:", fontStyles);
    // console.log("Found no font styles:", noFontStyles);

    return { fontStyles, noFontStyles };
  }

  // Get Styles
  if (msg.type === 'getStyles') {
    const selection = figma.currentPage.selection;

    // 1- Take the current selection (one or multiple objects)
    if (selection.length > 0) {
      // 2- Check if the selection is not already an autolayout group called "Matcher Workbench"
      const groupName = "Matcher Workbench";
      let group: FrameNode;

      if (selection.length === 1 && selection[0].type === 'FRAME' && selection[0].name === groupName) {
        group = selection[0] as FrameNode;
      } else {
        // Calculate the bounding box of the selected items
        let minX = Infinity;
        let minY = Infinity;

        for (const node of selection) {
          const nodeBounds = node.absoluteTransform;
          minX = Math.min(minX, nodeBounds[0][2]);
          minY = Math.min(minY, nodeBounds[1][2]);
        }

        // Convert selection into an autolayout frame with the specified specs
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
      const colorStylesResults = findColorStyles(group);
      const fontStylesResults = findFontStyles(group);

      if (group) {
        const colorStyles = colorStylesResults.colorStyles;
        const noColorStyles = colorStylesResults.noColorStyles;
        const fontStyles = fontStylesResults.fontStyles;
        const noFontStyles = fontStylesResults.noFontStyles;

        // Send the gathered color styles and font styles to the UI (ui.html)
        figma.ui.postMessage({ type: 'colorStyles', styles: colorStyles });
        figma.ui.postMessage({ type: 'noColorStyles', styles: noColorStyles });
        figma.ui.postMessage({ type: 'fontStyles', styles: fontStyles });
        figma.ui.postMessage({ type: 'noFontStyles', styles: noFontStyles });

        // console.log(colorStyles);
        // console.log(noColorStyles);
      }

    } else {
      figma.notify('Please select something.');
    }
  }

  if (msg.type === 'getAllStyles') {
    const selection = figma.currentPage.selection;

    // 1- Take the current selection (one or multiple objects)
    if (selection.length > 0) {
      // 2- Check if the selection is not already an autolayout group called "Matcher Workbench"
      const groupName = "Matcher Workbench";
      let group: FrameNode;

      if (selection.length === 1 && selection[0].type === 'FRAME' && selection[0].name === groupName) {
        group = selection[0] as FrameNode;
      } else {
        // Calculate the bounding box of the selected items
        let minX = Infinity;
        let minY = Infinity;

        for (const node of selection) {
          const nodeBounds = node.absoluteTransform;
          minX = Math.min(minX, nodeBounds[0][2]);
          minY = Math.min(minY, nodeBounds[1][2]);
        }

        // Convert selection into an autolayout frame with the specified specs
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
      const colorStylesResults = findAllColorStyles(group);
      const fontStylesResults = findAllFontStyles(group);

      if (group) {
        const allColorStyles = colorStylesResults.colorStyles;
        const allNoColorStyles = colorStylesResults.noColorStyles;
        const allFontStyles = fontStylesResults.fontStyles;
        const allNoFontStyles = fontStylesResults.noFontStyles;

        // Send the gathered color styles and font styles to the UI (ui.html)
        figma.ui.postMessage({ type: 'allColorStyles', styles: allColorStyles });
        figma.ui.postMessage({ type: 'allNoColorStyles', styles: allNoColorStyles });
        figma.ui.postMessage({ type: 'allFontStyles', styles: allFontStyles });
        figma.ui.postMessage({ type: 'allNoFontStyles', styles: allNoFontStyles });
      }

    } else {
      figma.notify('Please select something.');
    }
  }

  // Refresh
  if (msg.type === 'refresh') {
    const groupName = "Matcher Workbench";
    const group = figma.currentPage.findOne(node => node.type === 'FRAME' && node.name === groupName) as FrameNode;

    if (group) {
      const colorStylesResults = findColorStyles(group);
      const fontStylesResults = findFontStyles(group);

      const colorStyles = colorStylesResults.colorStyles;
      const noColorStyles = colorStylesResults.noColorStyles;
      const fontStyles = fontStylesResults.fontStyles;
      const noFontStyles = fontStylesResults.noFontStyles;

      // Send the gathered color styles and font styles to the UI (ui.html)
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

  // Check the parenting relationship between nodes in the array
  function checkParentingRelationship(nodes: any[]): boolean[] {
    const results: boolean[] = [];

    for (const nodeA of nodes) {
      let isInsideAnotherNode = false;
      for (const nodeB of nodes) {
        if (nodeA.id !== nodeB.id) {
          const nodeAInFigma = figma.getNodeById(nodeA.id) as BaseNode;
          const nodeBInFigma = figma.getNodeById(nodeB.id) as BaseNode;

          if (isDescendant(nodeBInFigma, nodeAInFigma)) {
            isInsideAnotherNode = true;
            break;
          }
        }
      }
      results.push(isInsideAnotherNode);
    }

    return results;
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

};
