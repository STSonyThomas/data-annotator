// src/annotation.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

const AnnotationEditor = () => {
    const [imageInfo, setImageInfo] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [imageData, setImageData] = useState(null);
    const [boxes, setBoxes] = useState([]);
    const [drawing, setDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
    const [currentBox, setCurrentBox] = useState(null);
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [newClassName, setNewClassName] = useState('');
    const [showFilled, setShowFilled] = useState(true); // Toggle between filled and border-only
    
    // New state for selection mode and selected box
    const [tool, setTool] = useState('draw'); // 'draw' or 'select'
    const [selectedBoxIndex, setSelectedBoxIndex] = useState(null);
    const [hoveredBoxIndex, setHoveredBoxIndex] = useState(null);
    
    const imageRef = useRef(null);
    const canvasRef = useRef(null);
    const classColors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF', '#33FFA1', '#FFC300', '#C70039'];

    // --- Drawing Logic ---
    const drawCanvas = useCallback(() => {
        console.log('🎨 [drawCanvas] Called');
        if (!canvasRef.current || !imageRef.current) {
            console.log('❌ [drawCanvas] Missing refs - canvas:', !!canvasRef.current, 'image:', !!imageRef.current);
            return;
        }
        
        const canvas = canvasRef.current;
        const image = imageRef.current;
        
        // Wait for image to be fully loaded
        if (!image.complete || image.naturalWidth === 0) {
            console.log('⏳ [drawCanvas] Image not ready - complete:', image.complete, 'naturalWidth:', image.naturalWidth);
            return;
        }
        
        console.log('✅ [drawCanvas] Drawing with:', {
            existingBoxes: boxes.length,
            hasCurrentBox: !!currentBox,
            isDrawing: drawing,
            showFilled: showFilled,
            selectedClass: selectedClass
        });
        
        const ctx = canvas.getContext('2d');

        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        
        // Clear the entire canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawAnnotationMask = (box, color, isDrawing = false, isSelected = false, isHovered = false) => {
            console.log('🖌️ [drawAnnotationMask]', {
                box: { x: box.x, y: box.y, width: box.width, height: box.height },
                class: box.class,
                color: color,
                isDrawing: isDrawing,
                isSelected: isSelected,
                isHovered: isHovered
            });
            
            // Draw filled semi-transparent mask
            if (showFilled) {
                ctx.fillStyle = color;
                let alpha = 0.2;
                if (isDrawing) alpha = 0.3;
                if (isSelected) alpha = 0.4;
                if (isHovered) alpha = 0.25;
                ctx.globalAlpha = alpha;
                ctx.fillRect(box.x, box.y, box.width, box.height);
            }
            
            // Always draw border
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = color;
            let lineWidth = 2;
            if (isSelected) {
                lineWidth = 4;
                ctx.setLineDash([10, 5]); // Dashed line for selected
            } else if (isHovered) {
                lineWidth = 3;
                ctx.setLineDash([5, 3]); // Different dash for hovered
            } else {
                ctx.setLineDash([]);
            }
            ctx.lineWidth = lineWidth;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
            
            // Draw class label with background
            const label = box.class || 'unknown';
            ctx.font = '14px Arial';
            const textMetrics = ctx.measureText(label);
            const textWidth = textMetrics.width;
            const textHeight = 16;
            
            // Label background
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.9;
            const labelY = box.y > 20 ? box.y - textHeight - 4 : box.y + box.height + 4;
            ctx.fillRect(box.x, labelY, textWidth + 8, textHeight + 4);
            
            // Label text
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = 'white';
            ctx.fillText(label, box.x + 4, labelY + textHeight);
        };

        // Draw all existing annotation masks
        boxes.forEach((box, index) => {
            const classIndex = classes.indexOf(box.class);
            const color = classColors[classIndex % classColors.length] || '#FF5733';
            const isSelected = selectedBoxIndex === index;
            const isHovered = hoveredBoxIndex === index;
            console.log(`📦 [drawCanvas] Drawing existing box ${index}:`, box, { isSelected, isHovered });
            drawAnnotationMask(box, color, false, isSelected, isHovered);
        });

        // Draw current drawing mask (if drawing)
        if (drawing && currentBox) {
            const classIndex = classes.indexOf(selectedClass);
            const color = classColors[classIndex % classColors.length] || '#FF5733';
            console.log('🔄 [drawCanvas] Drawing current box:', currentBox);
            drawAnnotationMask(currentBox, color, true);
        }
        
        // Reset global alpha
        ctx.globalAlpha = 1.0;
        console.log('✨ [drawCanvas] Completed drawing');
    }, [boxes, classes, drawing, currentBox, selectedClass, classColors, showFilled, selectedBoxIndex, hoveredBoxIndex]);

    useEffect(() => {
        console.log('🔄 [useEffect-drawCanvas] Triggered by state change:', {
            boxesCount: boxes.length,
            drawing: drawing,
            hasCurrentBox: !!currentBox,
            showFilled: showFilled,
            selectedBoxIndex: selectedBoxIndex,
            hoveredBoxIndex: hoveredBoxIndex
        });
        drawCanvas();
    }, [boxes, drawing, currentBox, showFilled, selectedBoxIndex, hoveredBoxIndex, drawCanvas]);

    // Additional effect to ensure canvas redraws when image data changes
    useEffect(() => {
        if (imageData && imageRef.current) {
            console.log('🖼️ [useEffect-imageData] Image data changed, scheduling redraw');
            // Small delay to ensure image is fully loaded before drawing annotations
            const timer = setTimeout(() => {
                console.log('⏰ [useEffect-imageData] Timer fired, calling drawCanvas');
                drawCanvas();
            }, 100);
            return () => {
                console.log('🧹 [useEffect-imageData] Cleanup timer');
                clearTimeout(timer);
            };
        }
    }, [imageData, drawCanvas]);

    // --- Data Fetching and Saving ---

    useEffect(() => {
        console.log('🎯 [useEffect-initialization] Fetching initial data');
        const fetchInitialData = async () => {
            const imageList = await window.electronAPI.getAnnotationList();
            console.log('📋 [useEffect-initialization] Image list:', imageList);
            setImageInfo(imageList);
            const projectClasses = await window.electronAPI.getProjectClasses();
            console.log('🏷️ [useEffect-initialization] Project classes:', projectClasses);
            setClasses(projectClasses);
            if (projectClasses.length > 0) {
                console.log('✅ [useEffect-initialization] Setting default class:', projectClasses[0]);
                setSelectedClass(projectClasses[0]);
            }
        };
        fetchInitialData();
    }, []);

    const loadAndSetImageData = useCallback(async (index) => {
        console.log('📂 [loadAndSetImageData] Loading image at index:', index);
        if (imageInfo.length > 0 && imageInfo[index]) {
            console.log('📸 [loadAndSetImageData] Loading:', imageInfo[index].name);
            const data = await window.electronAPI.getImageData(imageInfo[index].name);
            setImageData(data ? `data:image/jpeg;base64,${data}` : null);
            
            console.log('🏷️ [loadAndSetImageData] Loading existing labels for:', imageInfo[index].name);
            try {
                const existingLabels = await window.electronAPI.getLabels(imageInfo[index].name);
                console.log('📋 [loadAndSetImageData] Loaded labels:', existingLabels);
                console.log('📋 [loadAndSetImageData] Labels type:', typeof existingLabels, 'Array?', Array.isArray(existingLabels));
                if (existingLabels && existingLabels.length > 0) {
                    console.log('📋 [loadAndSetImageData] First label:', existingLabels[0]);
                }
                setBoxes(existingLabels || []);
            } catch (error) {
                console.error('💥 [loadAndSetImageData] Error loading labels:', error);
                setBoxes([]);
            }
        } else {
            console.log('❌ [loadAndSetImageData] No image info or invalid index');
        }
    }, [imageInfo]);

    useEffect(() => {
        console.log('🚀 [useEffect-currentIndex] Index changed to:', currentIndex);
        // Clear selection when changing images
        setSelectedBoxIndex(null);
        setHoveredBoxIndex(null);
        loadAndSetImageData(currentIndex);
    }, [currentIndex, imageInfo, loadAndSetImageData]);

    const saveLabels = useCallback(async (boxesToSave) => {
        console.log('💾 [saveLabels] Saving labels:', boxesToSave);
        if (!imageRef.current || !imageInfo[currentIndex]) {
            console.log('❌ [saveLabels] Cannot save - missing image ref or image info');
            return;
        }
        
        const { naturalWidth, naturalHeight } = imageRef.current;
        console.log('📐 [saveLabels] Image dimensions:', { naturalWidth, naturalHeight });
        
        const yoloStrings = boxesToSave.map(box => {
            const classIndex = classes.indexOf(box.class);
            if (classIndex === -1) {
                console.log('⚠️ [saveLabels] Class not found:', box.class);
                return null;
            }
            const x_center = (box.x + box.width / 2) / naturalWidth;
            const y_center = (box.y + box.height / 2) / naturalHeight;
            const width = box.width / naturalWidth;
            const height = box.height / naturalHeight;
            const yoloString = `${classIndex} ${x_center.toFixed(6)} ${y_center.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`;
            console.log('📝 [saveLabels] YOLO string for box:', yoloString);
            return yoloString;
        }).filter(Boolean);
        
        console.log('📄 [saveLabels] Final YOLO content:', yoloStrings.join('\n'));
        try {
            await window.electronAPI.saveYoloLabels(imageInfo[currentIndex].name, yoloStrings.join('\n'));
            console.log('✅ [saveLabels] Save completed successfully');
        } catch (error) {
            console.error('💥 [saveLabels] Error saving:', error);
        }
        
        setImageInfo(prevInfo => {
            const newInfo = [...prevInfo];
            if (newInfo[currentIndex]) {
                newInfo[currentIndex].isAnnotated = boxesToSave.length > 0;
                console.log('🔄 [saveLabels] Updated annotation status:', newInfo[currentIndex].isAnnotated);
            }
            return newInfo;
        });
    }, [currentIndex, imageInfo, classes]);

    // --- Event Handlers ---

    const getMousePos = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    // Function to check if a point is inside a box
    const isPointInBox = (point, box) => {
        return point.x >= box.x && 
               point.x <= box.x + box.width && 
               point.y >= box.y && 
               point.y <= box.y + box.height;
    };

    // Function to find which box (if any) contains the given point
    const findBoxAtPoint = (point) => {
        // Check boxes in reverse order (top-to-bottom in z-order)
        for (let i = boxes.length - 1; i >= 0; i--) {
            if (isPointInBox(point, boxes[i])) {
                return i;
            }
        }
        return null;
    };

    const handleMouseDown = (e) => {
        console.log('🖱️ [handleMouseDown] Mouse down event, tool:', tool);
        if (e.button !== 0) {
            console.log('❌ [handleMouseDown] Not left click, ignoring');
            return; // Only allow left click
        }

        const pos = getMousePos(e);
        
        if (tool === 'select') {
            // Selection mode: check if clicking on an existing box
            const clickedBoxIndex = findBoxAtPoint(pos);
            console.log('🎯 [handleMouseDown] Select mode - clicked box index:', clickedBoxIndex);
            
            if (clickedBoxIndex !== null) {
                setSelectedBoxIndex(clickedBoxIndex);
                console.log('✅ [handleMouseDown] Selected box:', boxes[clickedBoxIndex]);
            } else {
                setSelectedBoxIndex(null);
                console.log('❌ [handleMouseDown] No box clicked, deselecting');
            }
            return;
        }
        
        // Drawing mode
        if (!selectedClass) {
            console.log('❌ [handleMouseDown] No class selected');
            return;
        }
        
        console.log('✅ [handleMouseDown] Starting to draw with class:', selectedClass);
        setDrawing(true);
        console.log('📍 [handleMouseDown] Start position:', pos);
        setStartPoint(pos);
    };

    const handleMouseMove = (e) => {
        const pos = getMousePos(e);
        
        // Handle hovering for selection mode
        if (tool === 'select' && !drawing) {
            const hoveredIndex = findBoxAtPoint(pos);
            if (hoveredIndex !== hoveredBoxIndex) {
                setHoveredBoxIndex(hoveredIndex);
            }
        }
        
        // Handle drawing
        if (!drawing) return;
        
        const width = pos.x - startPoint.x;
        const height = pos.y - startPoint.y;
        const newCurrentBox = {
            x: width > 0 ? startPoint.x : pos.x,
            y: height > 0 ? startPoint.y : pos.y,
            width: Math.abs(width),
            height: Math.abs(height),
            class: selectedClass
        };
        
        console.log('🔄 [handleMouseMove] Current box:', newCurrentBox);
        setCurrentBox(newCurrentBox);
        // Immediately redraw to show live annotation mask
        drawCanvas();
    };

    const handleMouseUp = () => {
        console.log('🖱️ [handleMouseUp] Mouse up event');
        if (!drawing || !currentBox) {
            console.log('❌ [handleMouseUp] Not drawing or no current box');
            return;
        }
        
        console.log('🔧 [handleMouseUp] Finishing annotation:', currentBox);
        setDrawing(false);
        
        if (currentBox.width > 5 && currentBox.height > 5) {
            console.log('✅ [handleMouseUp] Box is large enough, adding to boxes');
            const updatedBoxes = [...boxes, { ...currentBox }];
            console.log('📦 [handleMouseUp] Updated boxes array:', updatedBoxes);
            setBoxes(updatedBoxes);
            saveLabels(updatedBoxes);
        } else {
            console.log('❌ [handleMouseUp] Box too small, discarding');
        }
        
        setCurrentBox(null);
        // Ensure canvas redraws with the new persistent annotation
        setTimeout(() => {
            console.log('⏰ [handleMouseUp] Timer fired, calling drawCanvas');
            drawCanvas();
        }, 50);
    };

    const handleMouseLeave = () => {
        setHoveredBoxIndex(null);
        handleMouseUp(); // Also handle mouse up if drawing
    };

    const handleKeyDown = useCallback(async (e) => {
        if (e.target.tagName.toLowerCase() === 'input') return;
        
        // Delete selected box with Delete key
        if (e.key === 'Delete' && selectedBoxIndex !== null) {
            console.log('🗑️ [handleKeyDown] Delete key pressed, removing box:', selectedBoxIndex);
            const updatedBoxes = boxes.filter((_, index) => index !== selectedBoxIndex);
            setBoxes(updatedBoxes);
            setSelectedBoxIndex(null);
            saveLabels(updatedBoxes);
            return;
        }
        
        if (e.key === 'ArrowRight') {
            setCurrentIndex(i => (i < imageInfo.length - 1 ? i + 1 : i));
        } else if (e.key === 'ArrowLeft') {
            setCurrentIndex(i => (i > 0 ? i - 1 : i));
        } else if (e.key.toLowerCase() === 'r' && currentIndex > 0) {
            const prevBoxes = await window.electronAPI.getLabels(imageInfo[currentIndex - 1].name);
            setBoxes(prevBoxes);
            saveLabels(prevBoxes);
        } else if (e.key.toLowerCase() === 't') {
            // Toggle fill mode with 'T' key
            setShowFilled(prev => !prev);
        } else if (e.key === 'Escape') {
            // Clear selection with Escape key
            setSelectedBoxIndex(null);
        }
    }, [currentIndex, imageInfo, saveLabels, selectedBoxIndex, boxes]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // --- UI Handlers ---

    const handleAddClass = async () => {
        if (newClassName && !classes.includes(newClassName)) {
            const updatedClasses = [...classes, newClassName];
            setClasses(updatedClasses);
            setSelectedClass(newClassName);
            setNewClassName('');
            await window.electronAPI.saveProjectClasses(updatedClasses);
        }
    };

    const handleDeleteClass = async (classToDelete) => {
        const updatedBoxes = boxes.filter(box => box.class !== classToDelete);
        setBoxes(updatedBoxes);
        saveLabels(updatedBoxes);

        const updatedClasses = classes.filter(c => c !== classToDelete);
        setClasses(updatedClasses);
        if (selectedClass === classToDelete) {
            setSelectedClass(updatedClasses[0] || '');
        }
        await window.electronAPI.saveProjectClasses(updatedClasses);
    };

    // Function to change the class of the selected box
    const handleChangeSelectedBoxClass = (newClass) => {
        if (selectedBoxIndex === null) return;
        
        console.log('🔄 [handleChangeSelectedBoxClass] Changing box class to:', newClass);
        const updatedBoxes = [...boxes];
        updatedBoxes[selectedBoxIndex] = { ...updatedBoxes[selectedBoxIndex], class: newClass };
        setBoxes(updatedBoxes);
        saveLabels(updatedBoxes);
    };

    // Function to delete the selected box
    const handleDeleteSelectedBox = () => {
        if (selectedBoxIndex === null) return;
        
        console.log('🗑️ [handleDeleteSelectedBox] Deleting selected box:', selectedBoxIndex);
        if (window.confirm("Are you sure you want to delete this annotation?")) {
            const updatedBoxes = boxes.filter((_, index) => index !== selectedBoxIndex);
            setBoxes(updatedBoxes);
            setSelectedBoxIndex(null);
            saveLabels(updatedBoxes);
        }
    };
    
    const handleClearAnnotations = () => {
        console.log('🗑️ [handleClearAnnotations] Clear annotations requested');
        if (window.confirm("Are you sure you want to delete all annotations for this image?")) {
            console.log('✅ [handleClearAnnotations] User confirmed, clearing annotations');
            console.log('📦 [handleClearAnnotations] Previous boxes count:', boxes.length);
            setBoxes([]);
            saveLabels([]);
            // Force canvas redraw to clear all annotations
            setTimeout(() => {
                console.log('⏰ [handleClearAnnotations] Timer fired, calling drawCanvas');
                drawCanvas();
            }, 50);
        } else {
            console.log('❌ [handleClearAnnotations] User cancelled');
        }
    };

    // --- Render ---
    const annotatedCount = imageInfo.filter(info => info.isAnnotated).length;
    const selectedBox = selectedBoxIndex !== null ? boxes[selectedBoxIndex] : null;

    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#333', color: 'white' }}>
            {/* Window Controls */}
            <div className="window-controls" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', backgroundColor: '#2c2c2c', borderBottom: '1px solid #555', zIndex: 9999 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'white' }}>Data Labeler - Annotation Editor</span>
                    <button 
                        onClick={() => window.electronAPI.closeAnnotationWindow()}
                        style={{ 
                            padding: '4px 12px', 
                            fontSize: '12px', 
                            backgroundColor: '#3498db', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '3px',
                            cursor: 'pointer'
                        }}
                    >
                        ← Back to Project
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => window.electronAPI.minimize()} style={{ padding: '2px 8px', fontSize: '12px', backgroundColor: '#555', color: 'white', border: 'none' }}>_</button>
                    <button onClick={() => window.electronAPI.maximize()} style={{ padding: '2px 8px', fontSize: '12px', backgroundColor: '#555', color: 'white', border: 'none' }}>▢</button>
                    <button onClick={() => window.electronAPI.close()} style={{ padding: '2px 8px', fontSize: '12px', backgroundColor: '#555', color: 'white', border: 'none' }}>✕</button>
                </div>
            </div>

            {/* Left Sidebar - Classes */}
            <div style={{ width: '250px', padding: '10px', borderRight: '1px solid #555', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '30px' }}>
                <h3>Classes</h3>
                <div style={{ display: 'flex' }}>
                    <input
                        type="text"
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddClass()}
                        placeholder="New class name"
                        style={{ flex: 1, marginRight: '5px', padding: '5px', borderRadius: '3px', border: '1px solid #666', backgroundColor: '#555', color: 'white' }}
                    />
                    <button onClick={handleAddClass}>Add</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {classes.map((cls, index) => (
                        <div key={cls} onClick={() => setSelectedClass(cls)} style={{ display: 'flex', alignItems: 'center', padding: '10px', cursor: 'pointer', border: `2px solid ${selectedClass === cls ? classColors[index % classColors.length] : 'transparent'}`, backgroundColor: '#444', marginBottom: '5px', borderRadius: '5px' }}>
                            <span style={{ color: classColors[index % classColors.length], fontWeight: 'bold', marginRight: '10px' }}>■</span>
                            <span style={{ flex: 1 }}>{cls}</span>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls); }}>X</button>
                        </div>
                    ))}
                </div>
                <button onClick={handleClearAnnotations} style={{backgroundColor: '#c0392b', color: 'white'}}>Clear Annotations</button>
                <button 
                    onClick={() => {
                        console.log('🔄 [ShowFill Toggle] Current state:', showFilled, '-> New state:', !showFilled);
                        setShowFilled(!showFilled);
                    }} 
                    style={{
                        backgroundColor: showFilled ? '#27ae60' : '#7f8c8d', 
                        color: 'white',
                        marginTop: '10px'
                    }}
                >
                    {showFilled ? 'Hide Fill' : 'Show Fill'}
                </button>
            </div>

            {/* Center Area - Image */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%', boxShadow: '0 0 20px black' }}>
                    {imageData && (
                        <img 
                            ref={imageRef} 
                            src={imageData} 
                            alt="annotation target" 
                            style={{ maxWidth: '100%', maxHeight: '100%', display: 'block', objectFit: 'contain' }} 
                            onLoad={() => {
                                console.log('🖼️ [Image onLoad] Image loaded, scheduling canvas redraw');
                                // Ensure canvas redraws after image loads with all annotations
                                setTimeout(() => {
                                    console.log('⏰ [Image onLoad] Timer fired, calling drawCanvas');
                                    drawCanvas();
                                }, 100);
                            }}
                        />
                    )}
                    <canvas 
                        ref={canvasRef} 
                        onMouseDown={handleMouseDown} 
                        onMouseMove={handleMouseMove} 
                        onMouseUp={handleMouseUp} 
                        onMouseLeave={handleMouseLeave} 
                        style={{ 
                            position: 'absolute', 
                            top: 0, 
                            left: 0, 
                            width: '100%', 
                            height: '100%', 
                            cursor: tool === 'select' ? 'pointer' : 'crosshair',
                            pointerEvents: 'auto'
                        }} 
                    />
                </div>
                <div style={{ position: 'absolute', bottom: '20px', display: 'flex', gap: '20px', backgroundColor: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '10px', alignItems: 'center' }}>
                    <button onClick={() => setCurrentIndex(i => (i > 0 ? i - 1 : i))} disabled={currentIndex === 0}>Previous (←)</button>
                    <div style={{textAlign: 'center', minWidth: '100px'}}>
                        <div>{currentIndex + 1} / {imageInfo.length}</div>
                        <div style={{fontSize: '12px', marginTop: '4px', color: '#99ff99'}}>Annotated: {annotatedCount}</div>
                    </div>
                    <button onClick={() => setCurrentIndex(i => (i < imageInfo.length - 1 ? i + 1 : i))} disabled={currentIndex >= imageInfo.length - 1}>Next (→)</button>
                </div>
            </div>

            {/* Right Sidebar - Tools */}
            <div style={{ width: '250px', padding: '10px', borderLeft: '1px solid #555', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '30px' }}>
                <h3>Tools</h3>
                
                {/* Tool Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <button 
                        onClick={() => {
                            setTool('draw');
                            setSelectedBoxIndex(null);
                        }}
                        style={{
                            padding: '10px',
                            backgroundColor: tool === 'draw' ? '#3498db' : '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer'
                        }}
                    >
                        🖊️ Draw Tool
                    </button>
                    <button 
                        onClick={() => {
                            setTool('select');
                        }}
                        style={{
                            padding: '10px',
                            backgroundColor: tool === 'select' ? '#3498db' : '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer'
                        }}
                    >
                        🎯 Select Tool
                    </button>
                </div>

                {/* Current Tool Info */}
                <div style={{ padding: '10px', backgroundColor: '#444', borderRadius: '5px', fontSize: '14px' }}>
                    <strong>Current Tool:</strong> {tool === 'draw' ? 'Draw Bounding Box' : 'Select Bounding Box'}
                    {tool === 'draw' && selectedClass && (
                        <div style={{ marginTop: '5px', color: '#99ff99' }}>
                            Drawing: <strong>{selectedClass}</strong>
                        </div>
                    )}
                </div>

                {/* Selection Info and Controls */}
                {selectedBox ? (
                    <div style={{ padding: '10px', backgroundColor: '#444', borderRadius: '5px' }}>
                        <h4 style={{ margin: '0 0 10px 0' }}>Selected Box</h4>
                        <div style={{ fontSize: '14px', marginBottom: '10px' }}>
                            <div><strong>Class:</strong> {selectedBox.class}</div>
                            <div><strong>Position:</strong> ({Math.round(selectedBox.x)}, {Math.round(selectedBox.y)})</div>
                            <div><strong>Size:</strong> {Math.round(selectedBox.width)} × {Math.round(selectedBox.height)}</div>
                        </div>
                        
                        {/* Class Change Dropdown */}
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Change Class:</label>
                            <select 
                                value={selectedBox.class}
                                onChange={(e) => handleChangeSelectedBoxClass(e.target.value)}
                                style={{ 
                                    width: '100%', 
                                    padding: '5px', 
                                    backgroundColor: '#555', 
                                    color: 'white', 
                                    border: '1px solid #666',
                                    borderRadius: '3px'
                                }}
                            >
                                {classes.map(cls => (
                                    <option key={cls} value={cls}>{cls}</option>
                                ))}
                            </select>
                        </div>
                        
                        {/* Delete Button */}
                        <button 
                            onClick={handleDeleteSelectedBox}
                            style={{
                                width: '100%',
                                padding: '8px',
                                backgroundColor: '#e74c3c',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer'
                            }}
                        >
                            🗑️ Delete Box
                        </button>
                    </div>
                ) : tool === 'select' ? (
                    <div style={{ padding: '10px', backgroundColor: '#444', borderRadius: '5px', fontSize: '14px', color: '#999' }}>
                        Click on a bounding box to select it
                    </div>
                ) : null}

                {/* Keyboard Shortcuts */}
                <div style={{ padding: '10px', backgroundColor: '#444', borderRadius: '5px', fontSize: '12px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Shortcuts</h4>
                    <div>← → : Navigate images</div>
                    <div>T : Toggle fill</div>
                    <div>R : Copy previous labels</div>
                    <div>Del : Delete selected box</div>
                    <div>Esc : Clear selection</div>
                </div>

                {/* Box List */}
                {boxes.length > 0 && (
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <h4 style={{ margin: '0 0 10px 0' }}>Annotations ({boxes.length})</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {boxes.map((box, index) => {
                                const classIndex = classes.indexOf(box.class);
                                const color = classColors[classIndex % classColors.length] || '#FF5733';
                                const isSelected = selectedBoxIndex === index;
                                
                                return (
                                    <div 
                                        key={index}
                                        onClick={() => {
                                            setTool('select');
                                            setSelectedBoxIndex(index);
                                        }}
                                        style={{
                                            padding: '8px',
                                            backgroundColor: isSelected ? '#3498db' : '#555',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            border: `2px solid ${isSelected ? color : 'transparent'}`
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ color: color, fontWeight: 'bold' }}>■</span>
                                            <span>{box.class}</span>
                                        </div>
                                        <div style={{ color: '#ccc', fontSize: '10px' }}>
                                            {Math.round(box.width)} × {Math.round(box.height)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<React.StrictMode><AnnotationEditor /></React.StrictMode>);
