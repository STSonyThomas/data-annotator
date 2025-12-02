// src/annotation.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import TitleBar from './TitleBar';
export const AnnotationEditor = ({ onBack }) => {
    // --- State Variables ---
    const [imageData, setImageData] = useState(null);
    const [imageInfo, setImageInfo] = useState([]); // Array of { name, isAnnotated }
    const [currentIndex, setCurrentIndex] = useState(0);
    const [boxes, setBoxes] = useState([]); // [{ x, y, width, height, class, confidence }]
    const [selectedBoxIndex, setSelectedBoxIndex] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
    const [currentRect, setCurrentRect] = useState(null); // For drawing new box
    const [tool, setTool] = useState('draw'); // 'draw' or 'select'
    const [resizingBoxIndex, setResizingBoxIndex] = useState(null);
    const [resizingHandle, setResizingHandle] = useState(null); // 'tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'
    const [isDragging, setIsDragging] = useState(false);
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [newClassName, setNewClassName] = useState('');
    const [showFilled, setShowFilled] = useState(true); // State for toggling fill

    // Model prediction states
    const [models, setModels] = useState([]);
    const [selectedModelId, setSelectedModelId] = useState('');
    const [isLoadingPrediction, setIsLoadingPrediction] = useState(false);

    // Auto Annotate States
    const [autoAnnotateMode, setAutoAnnotateMode] = useState('current'); // 'current', 'range', 'all'
    const [rangeStart, setRangeStart] = useState(1);
    const [rangeEnd, setRangeEnd] = useState(1);
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

    // --- Refs ---
    const canvasRef = useRef(null);
    const imageRef = useRef(null);

    // --- Constants ---
    const classColors = [
        '#FF6347', '#4682B4', '#3CB371', '#FFD700', '#9370DB',
        '#FFA07A', '#20B2AA', '#778899', '#BA55D3', '#ADFF2F',
        '#FF69B4', '#87CEEB', '#DAA520', '#6A5ACD', '#F08080'
    ];
    const HANDLE_SIZE = 8; // Size of resize handles

    // --- Utility Functions ---

    // Function to get mouse coordinates relative to the canvas
    const getMousePos = (canvas, evt) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (evt.clientX - rect.left) * scaleX,
            y: (evt.clientY - rect.top) * scaleY
        };
    };

    // Function to draw all boxes on the canvas
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imageRef.current;

        console.log('🎨 [drawCanvas] Drawing canvas...');
        if (!canvas || !img || !imageData) {
            console.log('🚫 [drawCanvas] Canvas, image, or imageData not ready.', { canvas: !!canvas, img: !!img, imageData: !!imageData });
            return;
        }

        const ctx = canvas.getContext('2d');

        // Set canvas dimensions to match image natural dimensions
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw image (if needed, but usually handled by img tag)
        // ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        boxes.forEach((box, index) => {
            const classIndex = classes.indexOf(box.class);
            const color = classColors[classIndex % classColors.length] || '#FF5733';

            ctx.strokeStyle = color;
            ctx.lineWidth = selectedBoxIndex === index ? 3 : 2;
            ctx.fillStyle = showFilled ? `${color}40` : 'transparent'; // 40 is for 25% opacity

            // Draw the rectangle
            ctx.strokeRect(box.x, box.y, box.width, box.height);
            if (showFilled) {
                ctx.fillRect(box.x, box.y, box.width, box.height);
            }

            // Draw class label
            ctx.fillStyle = color;
            ctx.font = '16px Arial';
            ctx.fillText(box.class, box.x + 5, box.y + 20);

            // Draw resize handles if this is the selected box and tool is 'select'
            if (selectedBoxIndex === index && tool === 'select') {
                ctx.fillStyle = 'white';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 1;

                // Top-left
                ctx.fillRect(box.x - HANDLE_SIZE / 2, box.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                ctx.strokeRect(box.x - HANDLE_SIZE / 2, box.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                // Top-right
                ctx.fillRect(box.x + box.width - HANDLE_SIZE / 2, box.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                ctx.strokeRect(box.x + box.width - HANDLE_SIZE / 2, box.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                // Bottom-left
                ctx.fillRect(box.x - HANDLE_SIZE / 2, box.y + box.height - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                ctx.strokeRect(box.x - HANDLE_SIZE / 2, box.y + box.height - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                // Bottom-right
                ctx.fillRect(box.x + box.width - HANDLE_SIZE / 2, box.y + box.height - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                ctx.strokeRect(box.x + box.width - HANDLE_SIZE / 2, box.y + box.height - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);

                // Mid-points for resizing
                // Top-middle
                ctx.fillRect(box.x + box.width / 2 - HANDLE_SIZE / 2, box.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                ctx.strokeRect(box.x + box.width / 2 - HANDLE_SIZE / 2, box.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                // Bottom-middle
                ctx.fillRect(box.x + box.width / 2 - HANDLE_SIZE / 2, box.y + box.height - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                ctx.strokeRect(box.x + box.width / 2 - HANDLE_SIZE / 2, box.y + box.height - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                // Left-middle
                ctx.fillRect(box.x - HANDLE_SIZE / 2, box.y + box.height / 2 - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                ctx.strokeRect(box.x - HANDLE_SIZE / 2, box.y + box.height / 2 - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                // Right-middle
                ctx.fillRect(box.x + box.width - HANDLE_SIZE / 2, box.y + box.height / 2 - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                ctx.strokeRect(box.x + box.width - HANDLE_SIZE / 2, box.y + box.height / 2 - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
            }
        });

        // Draw the current rectangle being drawn
        if (isDrawing && currentRect) {
            ctx.strokeStyle = '#00FFFF'; // Cyan for new box
            ctx.lineWidth = 2;
            ctx.fillStyle = '#00FFFF40';
            ctx.strokeRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
            ctx.fillRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
        }
    }, [boxes, selectedBoxIndex, isDrawing, currentRect, classes, showFilled, tool, imageData]);

    // Function to save labels to the backend
    const saveLabels = useCallback(async (currentBoxes) => {
        if (!imageInfo[currentIndex]) return;
        const imageName = imageInfo[currentIndex].name;
        try {
            await window.electronAPI.saveYoloLabels(imageName, currentBoxes);
            // Update imageInfo to reflect annotation status
            setImageInfo(prev => prev.map((info, idx) =>
                idx === currentIndex ? { ...info, isAnnotated: currentBoxes.length > 0 } : info
            ));
        } catch (error) {
            console.error('Error saving labels:', error);
        }
    }, [imageInfo, currentIndex]);

    // --- Model Prediction Handlers ---

    // Helper function to predict for a single image
    const predictForImage = async (index, projectPath) => {
        const image = imageInfo[index];
        if (!image) return { success: false, error: 'Image not found' };

        try {
            // Get image data as base64
            const imageBase64 = await window.electronAPI.getImageData(image.name);
            if (!imageBase64) {
                return { success: false, error: 'Failed to load image data' };
            }

            // Send base64 data to backend
            const result = await window.electronAPI.predictWithModel(projectPath, selectedModelId, `data:image/jpeg;base64,${imageBase64}`);

            if (result.success) {
                // We need to process predictions relative to THAT image's dimensions
                // Since we don't have the image loaded in an img tag, we rely on the backend or assume standard processing
                // For now, let's load the image dimensions if needed, but processPredictions uses imageRef.current
                // which is the CURRENTLY displayed image. This is a problem for batch processing.
                // FIX: processPredictions needs to accept dimensions or we need to load them.
                // However, the backend conversion to YOLO format handles normalization if we save raw pixel values.
                // But processPredictions converts FROM normalized/pixel to pixel values for display?
                // Wait, processPredictions converts backend format to our internal box format.

                // Let's check processPredictions.
                // It uses imageRef.current.naturalWidth. This MUST be fixed for batch processing.

                // For batch processing, we might need to get dimensions from the backend or load the image.
                // Since we are in the renderer, loading every image into an Image object to get dimensions is slow but accurate.

                return { success: true, predictions: result.predictions };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const handlePredictWithModel = async () => {
        if (!selectedModelId) {
            alert('Please select a model');
            return;
        }

        setIsLoadingPrediction(true);
        setIsBatchProcessing(true);

        try {
            const projectPath = await window.electronAPI.getProjectPath();

            let indicesToProcess = [];

            if (autoAnnotateMode === 'current') {
                indicesToProcess = [currentIndex];
            } else if (autoAnnotateMode === 'range') {
                const start = Math.max(0, rangeStart - 1);
                const end = Math.min(imageInfo.length - 1, rangeEnd - 1);
                for (let i = start; i <= end; i++) indicesToProcess.push(i);
            } else if (autoAnnotateMode === 'all') {
                for (let i = 0; i < imageInfo.length; i++) indicesToProcess.push(i);
            }

            setBatchProgress({ current: 0, total: indicesToProcess.length });

            let successCount = 0;

            for (let i = 0; i < indicesToProcess.length; i++) {
                const idx = indicesToProcess[i];
                const image = imageInfo[idx];

                // Update progress
                setBatchProgress({ current: i + 1, total: indicesToProcess.length });

                // If it's the current image, we can use the existing logic to update UI immediately
                if (idx === currentIndex) {
                    // Existing logic for current image
                    const result = await predictForImage(idx, projectPath);
                    if (result.success) {
                        const predictedBoxes = processPredictions(result.predictions, imageRef.current?.naturalWidth, imageRef.current?.naturalHeight);
                        const newBoxes = [...boxes, ...predictedBoxes];
                        setBoxes(newBoxes);
                        saveLabels(newBoxes);
                        successCount++;
                    }
                } else {
                    // Background processing for other images
                    // We need dimensions to convert predictions if they are not normalized.
                    // If the model returns normalized coordinates (0-1), we don't need dimensions to save YOLO (which is also 0-1).
                    // BUT, our internal format is pixel-based.
                    // If we save to YOLO directly, we need to know if we should convert to pixel or keep normalized.
                    // Our saveLabels function takes pixel-based boxes and converts to YOLO (normalized) using getImageDimensions in backend.
                    // So we need to create pixel-based boxes here to pass to saveLabels (or a modified save function).

                    // To get dimensions without rendering:
                    // We can ask backend for dimensions since it has the file.
                    // Or we can load into an Image object.

                    const result = await predictForImage(idx, projectPath);
                    if (result.success) {
                        // Create a temporary image to get dimensions
                        const img = new Image();
                        img.src = `data:image/jpeg;base64,${await window.electronAPI.getImageData(projectPath, image.name, 'annotation')}`;
                        await new Promise(resolve => img.onload = resolve);

                        const predictedBoxes = processPredictions(result.predictions, img.naturalWidth, img.naturalHeight);

                        // We need to merge with existing labels if any?
                        // For now, let's append.
                        const existingLabels = await window.electronAPI.getLabels(image.name);
                        const newBoxes = [...existingLabels, ...predictedBoxes];

                        // Save using the backend handler (which expects pixel values and converts to YOLO)
                        await window.electronAPI.saveYoloLabels(image.name, newBoxes);

                        // Update imageInfo isAnnotated status locally
                        setImageInfo(prev => prev.map((info, index) =>
                            index === idx ? { ...info, isAnnotated: true } : info
                        ));
                        successCount++;
                    }
                }
            }

            alert(`Batch annotation complete! Successfully annotated ${successCount} images.`);

        } catch (error) {
            console.error('Error making prediction:', error);
            alert(`Error making prediction: ${error.message}`);
        } finally {
            setIsLoadingPrediction(false);
            setIsBatchProcessing(false);
            setBatchProgress({ current: 0, total: 0 });
        }
    };

    const processPredictions = (predictions, imgWidth, imgHeight) => {
        // Convert predictions from your FastAPI server format to our box format
        if (!predictions || !Array.isArray(predictions)) {
            console.warn('Invalid predictions format:', predictions);
            return [];
        }

        return predictions.map(pred => {
            // Your server returns: { class_id, class_name, confidence, bbox: {x1, y1, x2, y2} }
            const { class_id, class_name, confidence, bbox } = pred;

            if (!bbox || typeof bbox.x1 === 'undefined') {
                console.warn('Invalid bbox format:', pred);
                return null;
            }

            // Use provided dimensions or fallback (though fallback is risky for batch)
            const w = imgWidth || 1;
            const h = imgHeight || 1;

            // Convert from corner coordinates to our format (top-left + width/height)
            const x = Math.max(0, Math.min(bbox.x1, imgWidth));
            const y = Math.max(0, Math.min(bbox.y1, imgHeight));
            const width = Math.max(1, Math.min(bbox.x2 - bbox.x1, imgWidth - x));
            const height = Math.max(1, Math.min(bbox.y2 - bbox.y1, imgHeight - y));

            // Use class name if available, otherwise use class ID, or default
            const className = class_name || (classes[class_id]) || `class_${class_id}` || 'predicted';

            return {
                x,
                y,
                width,
                height,
                class: className,
                confidence: confidence || 0
            };
        }).filter(box => box !== null && box.width > 5 && box.height > 5); // Filter out invalid or very small boxes
    };

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

    // --- Effects ---

    // Load image list and initial image/labels on component mount
    const [projectPath, setProjectPath] = useState(null);

    useEffect(() => {
        console.log('🚀 [AnnotationEditor] Component mounted');
        const loadProjectData = async () => {
            console.log('🔄 [AnnotationEditor] Loading project data...');
            try {
                const path = await window.electronAPI.getProjectPath();
                console.log('📂 [AnnotationEditor] Project path:', path);
                setProjectPath(path);

                const images = await window.electronAPI.getAnnotationList();
                console.log('🖼️ [AnnotationEditor] Images loaded:', images);
                setImageInfo(images);

                const loadedClasses = await window.electronAPI.getProjectClasses();
                console.log('🏷️ [AnnotationEditor] Classes loaded:', loadedClasses);
                setClasses(loadedClasses);
                if (loadedClasses.length > 0) {
                    setSelectedClass(loadedClasses[0]);
                }

                // Load models
                const loadedModels = await window.electronAPI.getModels(projectPath);
                setModels(loadedModels);
                if (loadedModels.length > 0) {
                    setSelectedModelId(loadedModels[0].id);
                }

            } catch (error) {
                console.error('Error loading project data:', error);
            }
        };
        loadProjectData();
    }, []);

    // Ref to track the currently loaded image to prevent unnecessary reloads
    const lastLoadedImageRef = useRef(null);

    // Effect to load image data and labels when currentIndex changes
    useEffect(() => {
        const loadImageAndLabels = async () => {
            if (imageInfo.length === 0) {
                console.log('⚠️ [AnnotationEditor] No images in imageInfo');
                setImageData(null);
                setBoxes([]);
                setSelectedBoxIndex(null);
                lastLoadedImageRef.current = null;
                return;
            }

            if (!projectPath) {
                console.log('⚠️ [AnnotationEditor] No project path available');
                return;
            }

            const currentImage = imageInfo[currentIndex];

            // Skip reload if we're already on this image (e.g. only isAnnotated changed)
            if (lastLoadedImageRef.current === currentImage.name) {
                console.log('⏭️ [AnnotationEditor] Skipping reload, image name unchanged:', currentImage.name);
                return;
            }

            console.log(`🔄 [AnnotationEditor] Loading image at index ${currentIndex}: ${currentImage.name}`);
            lastLoadedImageRef.current = currentImage.name;

            try {
                console.log(`📥 [AnnotationEditor] Fetching image data for: ${currentImage.name}`);
                const data = await window.electronAPI.getImageData(projectPath, currentImage.name, 'annotation');
                console.log('📦 [AnnotationEditor] Image data received (length):', data ? data.length : 0);
                setImageData(`data:image/jpeg;base64,${data}`); // Assuming JPEG, adjust if needed

                console.log(`🏷️ [AnnotationEditor] Fetching labels for: ${currentImage.name}`);
                const loadedBoxes = await window.electronAPI.getLabels(currentImage.name);
                console.log('📦 [AnnotationEditor] Labels received:', loadedBoxes);
                setBoxes(loadedBoxes);
                setSelectedBoxIndex(null); // Clear selection on image change
            } catch (error) {
                console.error('Error loading image or labels:', error);
                setImageData(null);
                setBoxes([]);
                lastLoadedImageRef.current = null; // Reset on error so we can try again
            }
        };

        loadImageAndLabels();
    }, [currentIndex, imageInfo, projectPath]);

    // Effect to redraw canvas when boxes, selectedBoxIndex, isDrawing, currentRect, classes, showFilled, or tool changes
    useEffect(() => {
        drawCanvas();
    }, [drawCanvas]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') {
                setCurrentIndex(prev => Math.min(imageInfo.length - 1, prev + 1));
            } else if (e.key === 'ArrowLeft') {
                setCurrentIndex(prev => Math.max(0, prev - 1));
            } else if (e.key === 't' || e.key === 'T') {
                setShowFilled(prev => !prev);
            } else if (e.key === 'Escape') {
                setSelectedBoxIndex(null);
                setTool('draw'); // Reset to draw tool after clearing selection
            } else if (e.key === 'Delete' && selectedBoxIndex !== null) {
                handleDeleteSelectedBox();
            } else if (e.key === 'd' || e.key === 'D') {
                setTool('draw');
                setSelectedBoxIndex(null);
            } else if (e.key === 's' || e.key === 'S') {
                setTool('select');
            } else if (e.key === 'r' || e.key === 'R') {
                // Copy labels from previous image
                if (currentIndex > 0) {
                    const prevImageName = imageInfo[currentIndex - 1].name;
                    window.electronAPI.getLabels(prevImageName)
                        .then(prevLabels => {
                            setBoxes(prevLabels);
                            saveLabels(prevLabels);
                            alert('Labels copied from previous image!');
                        })
                        .catch(error => console.error('Error copying labels:', error));
                } else {
                    alert('No previous image to copy labels from.');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [currentIndex, imageInfo, selectedBoxIndex, handleDeleteSelectedBox, saveLabels]);

    // --- Mouse Event Handlers ---

    const getHandleAtPoint = (x, y, box) => {
        const handles = {
            tl: { x: box.x, y: box.y },
            tr: { x: box.x + box.width, y: box.y },
            bl: { x: box.x, y: box.y + box.height },
            br: { x: box.x + box.width, y: box.y + box.height },
            t: { x: box.x + box.width / 2, y: box.y },
            b: { x: box.x + box.width / 2, y: box.y + box.height },
            l: { x: box.x, y: box.y + box.height / 2 },
            r: { x: box.x + box.width, y: box.y + box.height / 2 },
        };

        for (const handleName in handles) {
            const h = handles[handleName];
            if (x >= h.x - HANDLE_SIZE / 2 && x <= h.x + HANDLE_SIZE / 2 &&
                y >= h.y - HANDLE_SIZE / 2 && y <= h.y + HANDLE_SIZE / 2) {
                return handleName;
            }
        }
        return null;
    };

    const handleMouseDown = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const { x, y } = getMousePos(canvas, e);

        if (tool === 'draw') {
            if (!selectedClass) {
                alert('Please select a class first!');
                return;
            }
            setIsDrawing(true);
            setStartPoint({ x, y });
            setCurrentRect({ x, y, width: 0, height: 0 });
            setSelectedBoxIndex(null); // Deselect any box when starting to draw
        } else if (tool === 'select') {
            let foundHandle = null;
            if (selectedBoxIndex !== null) {
                const selectedBox = boxes[selectedBoxIndex];
                foundHandle = getHandleAtPoint(x, y, selectedBox);
            }

            if (foundHandle) {
                setResizingBoxIndex(selectedBoxIndex);
                setResizingHandle(foundHandle);
                setStartPoint({ x, y }); // Store start point for resizing
            } else {
                // Check if clicking inside an existing box
                let clickedBoxIndex = null;
                for (let i = boxes.length - 1; i >= 0; i--) { // Iterate backwards to select top-most box
                    const box = boxes[i];
                    if (x >= box.x && x <= box.x + box.width &&
                        y >= box.y && y <= box.y + box.height) {
                        clickedBoxIndex = i;
                        break;
                    }
                }
                setSelectedBoxIndex(clickedBoxIndex);
                if (clickedBoxIndex !== null) {
                    setIsDragging(true);
                    setStartPoint({ x, y }); // Store start point for dragging
                }
            }
        }
    };

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        const { x, y } = getMousePos(canvas, e);
        const imgWidth = imageRef.current?.naturalWidth || 1;
        const imgHeight = imageRef.current?.naturalHeight || 1;

        if (tool === 'draw' && isDrawing) {
            const newX = Math.min(Math.max(0, startPoint.x), Math.max(0, x));
            const newY = Math.min(Math.max(0, startPoint.y), Math.max(0, y));
            const newWidth = Math.abs(x - startPoint.x);
            const newHeight = Math.abs(y - startPoint.y);

            setCurrentRect({
                x: newX,
                y: newY,
                width: newWidth,
                height: newHeight,
            });
        } else if (tool === 'select') {
            const updatedBoxes = [...boxes];
            let boxToModify = null;

            if (resizingBoxIndex !== null) {
                boxToModify = updatedBoxes[resizingBoxIndex];
            } else if (isDragging && selectedBoxIndex !== null) {
                boxToModify = updatedBoxes[selectedBoxIndex];
            }

            if (!boxToModify) return;

            const dx = x - startPoint.x;
            const dy = y - startPoint.y;

            if (resizingBoxIndex !== null && resizingHandle) {
                // Resizing logic
                let newX = boxToModify.x;
                let newY = boxToModify.y;
                let newWidth = boxToModify.width;
                let newHeight = boxToModify.height;

                switch (resizingHandle) {
                    case 'tl':
                        newX += dx; newY += dy;
                        newWidth -= dx; newHeight -= dy;
                        break;
                    case 'tr':
                        newY += dy;
                        newWidth += dx; newHeight -= dy;
                        break;
                    case 'bl':
                        newX += dx;
                        newWidth -= dx; newHeight += dy;
                        break;
                    case 'br':
                        newWidth += dx; newHeight += dy;
                        break;
                    case 't':
                        newY += dy; newHeight -= dy;
                        break;
                    case 'b':
                        newHeight += dy;
                        break;
                    case 'l':
                        newX += dx; newWidth -= dx;
                        break;
                    case 'r':
                        newWidth += dx;
                        break;
                    default:
                        break;
                }

                // Ensure minimum size and stay within image bounds
                newWidth = Math.max(1, newWidth);
                newHeight = Math.max(1, newHeight);
                newX = Math.max(0, Math.min(newX, imgWidth - newWidth));
                newY = Math.max(0, Math.min(newY, imgHeight - newHeight));

                boxToModify.x = newX;
                boxToModify.y = newY;
                boxToModify.width = newWidth;
                boxToModify.height = newHeight;

                setStartPoint({ x, y }); // Update start point for continuous resizing
            } else if (isDragging && selectedBoxIndex !== null) {
                // Dragging logic
                boxToModify.x = Math.max(0, Math.min(boxToModify.x + dx, imgWidth - boxToModify.width));
                boxToModify.y = Math.max(0, Math.min(boxToModify.y + dy, imgHeight - boxToModify.height));
                setStartPoint({ x, y }); // Update start point for continuous dragging
            }
            setBoxes(updatedBoxes);
        }
    };

    const handleMouseUp = () => {
        if (tool === 'draw' && isDrawing) {
            setIsDrawing(false);
            if (currentRect && currentRect.width > 5 && currentRect.height > 5) { // Minimum size for a valid box
                const newBox = {
                    ...currentRect,
                    class: selectedClass,
                    confidence: 1 // Manually drawn boxes have 100% confidence
                };
                const updatedBoxes = [...boxes, newBox];
                setBoxes(updatedBoxes);
                saveLabels(updatedBoxes);
            }
            setCurrentRect(null);
        } else if (tool === 'select') {
            if (resizingBoxIndex !== null || isDragging) {
                saveLabels(boxes); // Save changes after resizing/dragging
            }
            setResizingBoxIndex(null);
            setResizingHandle(null);
            setIsDragging(false);
        }
    };

    const handleMouseLeave = () => {
        // If drawing, cancel the current draw operation
        if (isDrawing) {
            setIsDrawing(false);
            setCurrentRect(null);
        }
        // If resizing/dragging, save the current state
        if (resizingBoxIndex !== null || isDragging) {
            saveLabels(boxes);
            setResizingBoxIndex(null);
            setResizingHandle(null);
            setIsDragging(false);
        }
    };




    // --- Annotation Menu Component ---
    const AnnotationMenu = ({ box, index }) => {
        if (!box) return null;

        // Calculate position
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();

        // Position relative to the viewport
        // We need to account for the canvas position on the screen
        // The box coordinates are relative to the image/canvas

        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;

        const boxX = box.x * scaleX + rect.left;
        const boxY = box.y * scaleY + rect.top;

        // Menu dimensions (approximate)
        const menuHeight = 40;

        // Position above by default, flip to below if not enough space
        let top = boxY - menuHeight - 10;
        if (top < rect.top) {
            top = boxY + (box.height * scaleY) + 10;
        }

        const left = boxX;

        return (
            <div style={{
                position: 'fixed',
                top: top,
                left: left,
                backgroundColor: '#333',
                padding: '5px',
                borderRadius: '4px',
                display: 'flex',
                gap: '5px',
                zIndex: 1000,
                boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                alignItems: 'center'
            }}>
                <select
                    value={box.class}
                    onChange={(e) => handleChangeSelectedBoxClass(e.target.value)}
                    style={{
                        backgroundColor: '#555',
                        color: 'white',
                        border: 'none',
                        padding: '4px',
                        borderRadius: '3px',
                        outline: 'none',
                        cursor: 'pointer'
                    }}
                >
                    {classes.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                    ))}
                </select>
                <button
                    onClick={handleDeleteSelectedBox}
                    style={{
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title="Delete Annotation"
                >
                    🗑️
                </button>
            </div>
        );
    };

    // --- Render ---
    const annotatedCount = imageInfo.filter(info => info.isAnnotated).length;
    const selectedBox = selectedBoxIndex !== null ? boxes[selectedBoxIndex] : null;

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e', color: 'white', fontFamily: 'sans-serif', paddingTop: '30px', boxSizing: 'border-box' }}>
            <TitleBar title="Image Annotation" />
            {/* Header */}
            <div style={{
                height: '40px',
                backgroundColor: '#2c2c2c',
                borderBottom: '1px solid #555',
                display: 'flex',
                alignItems: 'center',
                padding: '0 15px',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button
                        onClick={onBack}
                        style={{
                            padding: '5px 10px',
                            backgroundColor: '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <span>←</span> Back
                    </button>
                    <span style={{ fontWeight: 'bold' }}>Image Annotation</span>
                    {imageInfo.length > 0 && (
                        <span style={{ color: '#ccc', fontSize: '14px' }}>
                            {imageInfo[currentIndex]?.name} ({currentIndex + 1}/{imageInfo.length})
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                        disabled={currentIndex === 0}
                        style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: '#444', color: 'white', border: 'none', borderRadius: '3px' }}
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => setCurrentIndex(i => Math.min(imageInfo.length - 1, i + 1))}
                        disabled={currentIndex === imageInfo.length - 1}
                        style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: '#444', color: 'white', border: 'none', borderRadius: '3px' }}
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Toolbar */}
                <div style={{ width: '50px', backgroundColor: '#252526', borderRight: '1px solid #3e3e42', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '10px', gap: '10px' }}>
                    <button
                        title="Draw (D)"
                        onClick={() => {
                            setTool('draw');
                            setSelectedBoxIndex(null);
                        }}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '4px',
                            border: tool === 'draw' ? '1px solid #007acc' : '1px solid transparent',
                            backgroundColor: tool === 'draw' ? '#3e3e42' : 'transparent',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px'
                        }}
                    >
                        ✏️
                    </button>
                    <button
                        title="Select (S)"
                        onClick={() => setTool('select')}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '4px',
                            border: tool === 'select' ? '1px solid #007acc' : '1px solid transparent',
                            backgroundColor: tool === 'select' ? '#3e3e42' : 'transparent',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px'
                        }}
                    >
                        👆
                    </button>

                    <div style={{ width: '30px', height: '1px', backgroundColor: '#3e3e42', margin: '5px 0' }}></div>

                    <button
                        title="Toggle Fill (T)"
                        onClick={() => setShowFilled(!showFilled)}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '4px',
                            border: '1px solid transparent',
                            backgroundColor: showFilled ? '#3e3e42' : 'transparent',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px'
                        }}
                    >
                        {showFilled ? '⬛' : '⬜'}
                    </button>

                    {tool === 'select' && selectedBoxIndex !== null && (
                        <button
                            title="Delete Selected (Del)"
                            onClick={handleDeleteSelectedBox}
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '4px',
                                border: '1px solid transparent',
                                backgroundColor: 'transparent',
                                color: '#ff4d4d',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '18px',
                                marginTop: 'auto',
                                marginBottom: '10px'
                            }}
                        >
                            🗑️
                        </button>
                    )}
                </div>

                {/* Canvas Area */}
                <div style={{ flex: 1, position: 'relative', overflow: 'auto', backgroundColor: '#1e1e1e', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {imageData ? (
                        <div style={{ position: 'relative', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                            <img
                                ref={imageRef}
                                src={imageData}
                                alt="Annotation target"
                                onLoad={() => {
                                    console.log('🖼️ [img.onLoad] Image loaded');
                                    drawCanvas();
                                }}
                                style={{ display: 'block', maxWidth: 'none' }}
                                draggable={false}
                            />
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
                                    cursor: tool === 'draw' ? 'crosshair' : 'default'
                                }}
                            />
                            {/* Render Floating Menu */}
                            {selectedBoxIndex !== null && !isDragging && !resizingBoxIndex && (
                                <AnnotationMenu box={boxes[selectedBoxIndex]} index={selectedBoxIndex} />
                            )}
                        </div>
                    ) : (
                        <div style={{ color: '#ccc' }}>
                            {imageInfo.length === 0 ? 'No images to annotate' : 'Loading image...'}
                        </div>
                    )}
                </div>

                {/* Right Sidebar */}
                <div style={{ width: '250px', backgroundColor: '#252526', borderLeft: '1px solid #3e3e42', display: 'flex', flexDirection: 'column', padding: '10px' }}>

                    {/* Model Prediction Section */}
                    <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #3e3e42' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#ccc' }}>AI Assistance</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <select
                                value={selectedModelId}
                                onChange={(e) => setSelectedModelId(e.target.value)}
                                style={{
                                    padding: '6px',
                                    backgroundColor: '#3c3c3c',
                                    color: 'white',
                                    border: '1px solid #555',
                                    borderRadius: '3px',
                                    width: '100%'
                                }}
                            >
                                <option value="" disabled>Select Model</option>
                                {models.map(model => (
                                    <option key={model.id} value={model.id}>
                                        {model.name} ({model.version})
                                    </option>
                                ))}
                            </select>

                            <select
                                value={autoAnnotateMode}
                                onChange={(e) => setAutoAnnotateMode(e.target.value)}
                                style={{
                                    padding: '6px',
                                    backgroundColor: '#3c3c3c',
                                    color: 'white',
                                    border: '1px solid #555',
                                    borderRadius: '3px',
                                    width: '100%'
                                }}
                            >
                                <option value="current">Current Image</option>
                                <option value="range">Range of Images</option>
                                <option value="all">All Images</option>
                            </select>

                            {autoAnnotateMode === 'range' && (
                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                    <input
                                        type="number"
                                        min="1"
                                        max={imageInfo.length}
                                        value={rangeStart}
                                        onChange={(e) => setRangeStart(parseInt(e.target.value) || 1)}
                                        placeholder="Start"
                                        style={{ width: '50%', padding: '5px', backgroundColor: '#3c3c3c', border: '1px solid #555', color: 'white', borderRadius: '3px' }}
                                    />
                                    <span>-</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max={imageInfo.length}
                                        value={rangeEnd}
                                        onChange={(e) => setRangeEnd(parseInt(e.target.value) || 1)}
                                        placeholder="End"
                                        style={{ width: '50%', padding: '5px', backgroundColor: '#3c3c3c', border: '1px solid #555', color: 'white', borderRadius: '3px' }}
                                    />
                                </div>
                            )}

                            <button
                                onClick={handlePredictWithModel}
                                disabled={!selectedModelId || isLoadingPrediction || !imageData}
                                style={{
                                    padding: '8px',
                                    backgroundColor: isLoadingPrediction ? '#555' : '#0e639c',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: isLoadingPrediction ? 'wait' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px'
                                }}
                            >
                                {isLoadingPrediction ? (
                                    <><span>⏳</span> {isBatchProcessing ? `Processing ${batchProgress.current}/${batchProgress.total}` : 'Processing...'}</>
                                ) : (
                                    <><span>🤖</span> Start Annotation</>
                                )}
                            </button>

                            {isBatchProcessing && (
                                <div style={{ width: '100%', height: '4px', backgroundColor: '#444', borderRadius: '2px', marginTop: '5px' }}>
                                    <div style={{
                                        width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                                        height: '100%',
                                        backgroundColor: '#007acc',
                                        borderRadius: '2px',
                                        transition: 'width 0.3s ease'
                                    }}></div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Class Selection */}
                    <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#ccc' }}>Classes</h4>
                        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                            <input
                                type="text"
                                value={newClassName}
                                onChange={(e) => setNewClassName(e.target.value)}
                                placeholder="New class name"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddClass()}
                                style={{ flex: 1, padding: '5px', backgroundColor: '#3c3c3c', border: '1px solid #555', color: 'white', borderRadius: '3px' }}
                            />
                            <button onClick={handleAddClass} style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: '#0e639c', color: 'white', border: 'none', borderRadius: '3px' }}>+</button>
                        </div>

                        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {classes.map((cls, idx) => (
                                <div
                                    key={cls}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '5px',
                                        backgroundColor: selectedClass === cls ? '#37373d' : 'transparent',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        border: selectedClass === cls ? '1px solid #007acc' : '1px solid transparent'
                                    }}
                                    onClick={() => {
                                        setSelectedClass(cls);
                                        // If a box is selected, update its class
                                        if (selectedBoxIndex !== null) {
                                            handleChangeSelectedBoxClass(cls);
                                        }
                                    }}
                                >
                                    <div style={{ width: '12px', height: '12px', backgroundColor: classColors[idx % classColors.length], marginRight: '8px', borderRadius: '2px' }}></div>
                                    <span style={{ flex: 1 }}>{cls}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm(`Delete class "${cls}"?`)) handleDeleteClass(cls);
                                        }}
                                        style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '0 5px' }}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Box List */}
                    {boxes.length > 0 && (
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#ccc' }}>Annotations ({boxes.length})</h4>
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
                                                backgroundColor: isSelected ? '#37373d' : '#2d2d30',
                                                borderRadius: '3px',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                border: isSelected ? `1px solid ${color}` : '1px solid #3e3e42',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '4px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <div style={{ width: '8px', height: '8px', backgroundColor: color, borderRadius: '50%' }}></div>
                                                <span style={{ fontWeight: 'bold', color: '#e1e1e1' }}>{box.class}</span>
                                                {box.confidence > 0 && (
                                                    <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#aaa' }}>
                                                        {Math.round(box.confidence * 100)}%
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ color: '#999', fontSize: '10px', marginLeft: '13px' }}>
                                                x: {Math.round(box.x)}, y: {Math.round(box.y)} • {Math.round(box.width)} × {Math.round(box.height)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnnotationEditor;
