// document.addEventListener('paste', (e) => {
//     const clipboardData = e.clipboardData || window.clipboardData;
//     const pastedText = clipboardData.getData('text');

//     if (pastedText.includes('<svg')) {
//         const canvas = document.getElementById('canvas');
//         const svgElement = new DOMParser().parseFromString(pastedText, "image/svg+xml").documentElement;
        
//         // Set position for the pasted SVG
//         svgElement.setAttribute('x', 100); // Default x position
//         svgElement.setAttribute('y', 100); // Default y position
        
//         canvas.appendChild(svgElement);
//         makeSVGDraggable(svgElement); // Make the pasted SVG draggable
//         updateLayerPanel(); // Update the layer panel after adding an SVG
//     }
// });

// // Basic animation function
// function animateElement(el, props) {
//     el.style.transition = 'all 1s ease-in-out';
//     el.style.transform = 'translateX(100px)';
// }

// let isPanning = false;
// let startX, startY;

// const canvasContainer = document.getElementById('canvas-container');
// const canvas = document.getElementById('canvas');
// let scale = 1; // Initial scale

// // Mouse wheel zoom
// canvasContainer.addEventListener('wheel', (e) => {
//     e.preventDefault();
//     const zoomFactor = 0.1; // Adjust zoom speed
//     if (e.deltaY < 0) {
//         scale += zoomFactor; // Zoom in
//     } else {
//         scale = Math.max(0.1, scale - zoomFactor); // Zoom out, prevent negative scale
//     }
//     canvas.style.transform = `scale(${scale})`; // Apply scale to canvas
// });

// // Mouse down and move for panning
// canvasContainer.addEventListener('mousedown', (e) => {
//     isPanning = true;
//     startX = e.clientX;
//     startY = e.clientY;
// });

// canvasContainer.addEventListener('mousemove', (e) => {
//     if (isPanning) {
//         const dx = e.clientX - startX;
//         const dy = e.clientY - startY;
//         canvas.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`; // Apply translation and scale
//     }
// });

// canvasContainer.addEventListener('mouseup', () => {
//     isPanning = false;
// });
// canvasContainer.addEventListener('mouseleave', () => {
//     isPanning = false;
// });

// const layerPanel = document.getElementById('layer-panel');

// // Function to make layers draggable
// function makeLayersDraggable() {
//     let draggedItem = null;

//     layerPanel.addEventListener('dragstart', (e) => {
//         draggedItem = e.target;
//         e.dataTransfer.effectAllowed = 'move';
//     });

//     layerPanel.addEventListener('dragover', (e) => {
//         e.preventDefault(); // Allow drop
//         e.dataTransfer.dropEffect = 'move';
//     });

//     layerPanel.addEventListener('drop', (e) => {
//         e.preventDefault();
//         if (draggedItem) {
//             const target = e.target.closest('.layer-item');
//             if (target && target !== draggedItem) {
//                 // Swap the layers
//                 const parent = layerPanel;
//                 parent.insertBefore(draggedItem, target.nextSibling);
//                 updateLayerPanel(); // Update the layer panel to reflect changes
//             }
//         }
//     });

//     // Make each layer item draggable
//     const layerItems = layerPanel.querySelectorAll('.layer-item');
//     layerItems.forEach(item => {
//         item.setAttribute('draggable', true);
//     });
// }

// // Function to create resize handles for SVGs
// function createResizeHandles(svg) {
//     const handle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
//     handle.setAttribute("width", 10);
//     handle.setAttribute("height", 10);
//     handle.setAttribute("fill", "blue");
//     handle.setAttribute("cursor", "nwse-resize");
//     handle.setAttribute("x", svg.getBBox().width - 5);
//     handle.setAttribute("y", svg.getBBox().height - 5);
//     handle.style.display = "none"; // Initially hidden
//     svg.appendChild(handle);

//     let isResizing = false;

//     handle.addEventListener('mousedown', (e) => {
//         e.stopPropagation(); // Prevent triggering the SVG drag
//         isResizing = true;
//     });

//     document.addEventListener('mousemove', (e) => {
//         if (isResizing) {
//             const newWidth = e.clientX - svg.getBBox().x;
//             const newHeight = e.clientY - svg.getBBox().y;
//             svg.setAttribute('width', newWidth);
//             svg.setAttribute('height', newHeight);
//             handle.setAttribute("x", newWidth - 5);
//             handle.setAttribute("y", newHeight - 5);
//         }
//     });

//     document.addEventListener('mouseup', () => {
//         isResizing = false;
//     });

//     return handle; // Return the handle for visibility control
// }

// // Function to create rotation handle for SVGs
// function createRotationHandle(svg) {
//     const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
//     handle.setAttribute("r", 10);
//     handle.setAttribute("fill", "red");
//     handle.setAttribute("cursor", "pointer");
//     handle.setAttribute("cx", svg.getBBox().width + 15);
//     handle.setAttribute("cy", svg.getBBox().height / 2);
//     handle.style.display = "none"; // Initially hidden
//     svg.appendChild(handle);

//     let isRotating = false;
//     let initialAngle;

//     handle.addEventListener('mousedown', (e) => {
//         e.stopPropagation(); // Prevent triggering the SVG drag
//         isRotating = true;
//         const bbox = svg.getBBox();
//         const centerX = bbox.x + bbox.width / 2;
//         const centerY = bbox.y + bbox.height / 2;
//         initialAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
//     });

//     document.addEventListener('mousemove', (e) => {
//         if (isRotating) {
//             const bbox = svg.getBBox();
//             const centerX = bbox.x + bbox.width / 2;
//             const centerY = bbox.y + bbox.height / 2;
//             const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
//             const rotation = currentAngle - initialAngle;
//             const newRotation = (rotation * 180) / Math.PI; // Convert to degrees
//             svg.setAttribute('transform', `rotate(${newRotation}, ${centerX}, ${centerY})`);
//         }
//     });

//     document.addEventListener('mouseup', () => {
//         isRotating = false;
//     });

//     return handle; // Return the handle for visibility control
// }

// // Function to make SVG elements draggable
// function makeSVGDraggable(svg) {
//     let isDragging = false;
//     let startX, startY;

//     svg.addEventListener('mousedown', (e) => {
//         e.preventDefault(); // Prevent default behavior to avoid text selection
//         isDragging = true;
//         startX = e.clientX;
//         startY = e.clientY;
//     });

//     svg.addEventListener('mousemove', (e) => {
//         if (isDragging) {
//             const dx = e.clientX - startX;
//             const dy = e.clientY - startY;

//             // Update the position of the SVG
//             const currentX = parseFloat(svg.getAttribute('x')) || 0;
//             const currentY = parseFloat(svg.getAttribute('y')) || 0;
//             svg.setAttribute('x', currentX + dx);
//             svg.setAttribute('y', currentY + dy);

//             startX = e.clientX; // Update start positions
//             startY = e.clientY;
//         }
//     });

//     svg.addEventListener('mouseup', () => {
//         isDragging = false;
//     });

//     svg.addEventListener('mouseleave', () => {
//         isDragging = false;
//     });
// }

// const svgColorInput = document.getElementById('svg-color');
// const svgWidthInput = document.getElementById('svg-width');
// const svgHeightInput = document.getElementById('svg-height');
// const svgOpacityInput = document.getElementById('svg-opacity');
// const svgStrokeColorInput = document.getElementById('svg-stroke-color');
// const svgStrokeWidthInput = document.getElementById('svg-stroke-width');
// const svgScaleInput = document.getElementById('svg-scale');
// let currentSelectedSVG = null; // Track the currently selected SVG

// // Function to update the properties panel based on the selected SVG
// function updatePropertiesPanel(svg) {
//     currentSelectedSVG = svg; // Set the currently selected SVG

//     // Get current properties
//     const currentColor = svg.getAttribute('fill') || '#000000'; // Default to black if no fill
//     const currentWidth = svg.getAttribute('width') || 100; // Default width
//     const currentHeight = svg.getAttribute('height') || 100; // Default height
//     const currentOpacity = svg.getAttribute('opacity') || 1; // Default opacity
//     const currentStrokeColor = svg.getAttribute('stroke') || '#000000'; // Default stroke color
//     const currentStrokeWidth = svg.getAttribute('stroke-width') || 1; // Default stroke width
//     const currentScale = svg.getAttribute('transform') ? svg.getAttribute('transform').match(/scale\(([^)]+)\)/)[1] : 1; // Default scale

//     // Set input values
//     svgColorInput.value = currentColor;
//     svgWidthInput.value = currentWidth;
//     svgHeightInput.value = currentHeight;
//     svgOpacityInput.value = currentOpacity;
//     svgStrokeColorInput.value = currentStrokeColor;
//     svgStrokeWidthInput.value = currentStrokeWidth;
//     svgScaleInput.value = currentScale; // Set scale input

//     // Add event listeners to update properties
//     svgColorInput.addEventListener('input', () => {
//         if (currentSelectedSVG) {
//             currentSelectedSVG.setAttribute('fill', svgColorInput.value);
//         }
//     });

//     svgWidthInput.addEventListener('input', () => {
//         if (currentSelectedSVG) {
//             currentSelectedSVG.setAttribute('width', svgWidthInput.value);
//         }
//     });

//     svgHeightInput.addEventListener('input', () => {
//         if (currentSelectedSVG) {
//             currentSelectedSVG.setAttribute('height', svgHeightInput.value);
//         }
//     });

//     svgOpacityInput.addEventListener('input', () => {
//         if (currentSelectedSVG) {
//             currentSelectedSVG.setAttribute('opacity', svgOpacityInput.value);
//         }
//     });

//     svgStrokeColorInput.addEventListener('input', () => {
//         if (currentSelectedSVG) {
//             currentSelectedSVG.setAttribute('stroke', svgStrokeColorInput.value);
//         }
//     });

//     svgStrokeWidthInput.addEventListener('input', () => {
//         if (currentSelectedSVG) {
//             currentSelectedSVG.setAttribute('stroke-width', svgStrokeWidthInput.value);
//         }
//     });

//     svgScaleInput.addEventListener('input', () => {
//         if (currentSelectedSVG) {
//             const scaleValue = svgScaleInput.value;
//             currentSelectedSVG.setAttribute('transform', `scale(${scaleValue})`);
//         }
//     });
// }

// // Function to update the layer panel
// function updateLayerPanel() {
//     layerPanel.innerHTML = ''; // Clear existing layers
//     const canvas = document.getElementById('canvas');
//     const svgs = canvas.querySelectorAll('svg'); // Get all SVGs in the canvas
//     svgs.forEach((svg, index) => {
//         const layerItem = document.createElement('div');
//         layerItem.className = 'layer-item p-1 hover:bg-zinc-700 cursor-pointer';
//         layerItem.textContent = `Layer ${index + 1}`;
        
//         // Add click event to select the layer
//         layerItem.addEventListener('click', () => {
//             // Logic to select the SVG element
//             svg.classList.toggle('border border-blue-500'); // Highlight selected layer
//             svg.classList.toggle('selected'); // Toggle highlight on SVG
//             updatePropertiesPanel(svg); // Update properties panel with selected SVG

//             // Highlight the corresponding layer item
//             const isSelected = svg.classList.contains('selected');
//             layerItem.classList.toggle('bg-blue-500', isSelected); // Change background color if selected
//         });

//         // Add delete functionality
//         const deleteButton = document.createElement('button');
//         deleteButton.textContent = '🗑️';
//         deleteButton.className = 'ml-2';
//         deleteButton.addEventListener('click', (e) => {
//             e.stopPropagation(); // Prevent triggering the layer selection
//             svg.remove(); // Remove the SVG from the canvas
//             updateLayerPanel(); // Update the layer panel
//         });

//         layerItem.appendChild(deleteButton);
//         layerPanel.appendChild(layerItem);

//         // Make the SVG draggable
//         makeSVGDraggable(svg);
//     });

//     makeLayersDraggable(); // Make layers draggable after updating
// }

// const keyframeList = document.getElementById('keyframe-list');
// const addKeyframeButton = document.getElementById('add-keyframe');

// // Function to add a new keyframe
// addKeyframeButton.addEventListener('click', () => {
//     const keyframeDiv = document.createElement('div');
//     keyframeDiv.className = 'keyframe';

//     const timeInput = document.createElement('input');
//     timeInput.type = 'number';
//     timeInput.placeholder = 'Time';
    
//     const valueInput = document.createElement('input');
//     valueInput.type = 'text';
//     valueInput.placeholder = 'Value';

//     const deleteButton = document.createElement('button');
//     deleteButton.textContent = '🗑️';
//     deleteButton.className = 'ml-2';
//     deleteButton.addEventListener('click', () => {
//         keyframeDiv.remove(); // Remove the keyframe
//     });

//     keyframeDiv.appendChild(timeInput);
//     keyframeDiv.appendChild(valueInput);
//     keyframeDiv.appendChild(deleteButton);
//     keyframeList.appendChild(keyframeDiv);
// });

// const shapeSelector = document.getElementById('shape-selector');
// const addShapeButton = document.getElementById('add-shape');

// // Function to create a shape based on the selected type
// function createShape(type) {
//     const canvas = document.getElementById('canvas');
//     let shape;

//     switch (type) {
//         case 'rectangle':
//             shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
//             shape.setAttribute("width", 100);
//             shape.setAttribute("height", 100);
//             shape.setAttribute("fill", "#000000");
//             shape.setAttribute("x", 100); // Default position
//             shape.setAttribute("y", 100); // Default position
//             break;
//         case 'circle':
//             shape = document.createElementNS("http://www.w3.org/2000/svg", "circle");
//             shape.setAttribute("r", 50);
//             shape.setAttribute("fill", "#000000");
//             shape.setAttribute("cx", 150); // Default position
//             shape.setAttribute("cy", 150); // Default position
//             break;
//         case 'polygon':
//             shape = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
//             shape.setAttribute("points", "100,10 40,198 190,78 10,78 160,198");
//             shape.setAttribute("fill", "#000000");
//             break;
//         default:
//             return; // No valid shape type
//     }

//     // Append the shape to the canvas
//     canvas.appendChild(shape);
//     makeSVGDraggable(shape); // Make the newly created shape draggable
//     updateLayerPanel(); // Update the layer panel after adding a shape
// }

// // Add event listener for the "Add Shape" button
// addShapeButton.addEventListener('click', () => {
//     const selectedShape = shapeSelector.value;
//     if (selectedShape) {
//         createShape(selectedShape);
//         shapeSelector.value = ""; // Reset the selector after adding
//     } else {
//         alert("Please select a shape type."); // Alert if no shape is selected
//     }
// });

// const importButton = document.querySelector('button[text="Import SVG"]'); // Adjust selector if necessary

// importButton.addEventListener('click', () => {
//     const input = document.createElement('input');
//     input.type = 'file';
//     input.accept = '.svg';
//     input.onchange = (event) => {
//         const file = event.target.files[0];
//         if (file) {
//             const reader = new FileReader();
//             reader.onload = (e) => {
//                 const svgContent = e.target.result;
//                 const canvas = document.getElementById('canvas');
//                 const svgElement = new DOMParser().parseFromString(svgContent, "image/svg+xml").documentElement;

//                 // Set position for the imported SVG
//                 svgElement.setAttribute('x', 100); // Default x position
//                 svgElement.setAttribute('y', 100); // Default y position

//                 // Append the SVG to the canvas
//                 canvas.appendChild(svgElement);
//                 makeSVGDraggable(svgElement); // Make the imported SVG draggable
//                 updateLayerPanel(); // Update the layer panel after adding an SVG
//             };
//             reader.readAsText(file);
//         }
//     };
//     input.click(); // Trigger the file input dialog
// });