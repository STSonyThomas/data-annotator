// main.js (Electron Main Process)

const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;

// --- App Setup and Window Management ---

app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
const isDev = process.env.NODE_ENV !== 'production';
let projectPathCache = null; // Cache the project path for the annotation window

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // Removes OS window frame
    titleBarStyle: 'hiddenInset', // Optional: hides native title bar but keeps traffic lights on macOS
    backgroundColor: '#1e1e1e', // Match your app's background
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

function createAnnotationWindow() {
  const annotationWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    parent: BrowserWindow.getAllWindows()[0],
    modal: true,
    frame: false, // Removes OS window frame
    titleBarStyle: 'hiddenInset', // Optional: hides native title bar but keeps traffic lights on macOS
    backgroundColor: '#1e1e1e', // Match your app's background
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  if (isDev) {
    annotationWindow.loadURL('http://localhost:5173/annotation.html');
  } else {
    annotationWindow.loadFile(path.join(__dirname, 'dist', 'annotation.html'));
  }
}

app.whenReady().then(createMainWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- Helpers ---

/**
 * Read image dimensions using Electron's nativeImage.
 * Falls back to reading the file into a Buffer if getSize() returns 0x0.
 */
async function getImageDimensions(imagePath) {
  let img = nativeImage.createFromPath(imagePath);
  let { width, height } = img.getSize();

  if (!width || !height) {
    // Fallback: some formats/paths may need explicit buffer
    const buf = await fsp.readFile(imagePath);
    img = nativeImage.createFromBuffer(buf);
    ({ width, height } = img.getSize());
  }

  if (!width || !height) {
    throw new Error(`Could not determine image dimensions for: ${imagePath}`);
  }
  return { width, height };
}

// --- IPC Handlers ---

// --- Project and File Management Handlers ---

ipcMain.handle('create-project', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Project Directory',
  });

  if (canceled || !filePaths || filePaths.length === 0) return null;

  const projectPath = filePaths[0];
  const projectName = path.basename(projectPath);

  await fsp.mkdir(path.join(projectPath, 'unlabeled'), { recursive: true });
  await fsp.mkdir(path.join(projectPath, 'annotation'), { recursive: true });
  await fsp.mkdir(path.join(projectPath, 'dataset'), { recursive: true });

  return { name: projectName, path: projectPath };
});

ipcMain.handle('open-project', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Project Directory',
  });

  if (canceled || !filePaths || filePaths.length === 0) return null;

  const projectPath = filePaths[0];
  const projectName = path.basename(projectPath);
  return { name: projectName, path: projectPath };
});

ipcMain.handle('list-project-files', async (event, projectPath) => {
  const stages = ['unlabeled', 'annotation', 'dataset'];
  const filesByStage = {};
  for (const stage of stages) {
    const stagePath = path.join(projectPath, stage);
    try {
      const files = await fsp.readdir(stagePath);
      const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
      const labelFiles = new Set(files.filter(f => /\.txt$/i.test(f)).map(f => path.basename(f, '.txt')));

      filesByStage[stage] = {
        images: imageFiles.map(name => ({
          name,
          isAnnotated: labelFiles.has(path.basename(name, path.extname(name)))
        }))
      };
    } catch (error) {
      console.error(`Error reading directory ${stagePath}:`, error);
      filesByStage[stage] = { images: [] };
    }
  }
  return filesByStage;
});

// Helper function to generate unique filename if duplicate exists
async function generateUniqueFilename(destDir, originalFileName) {
  const extname = path.extname(originalFileName);
  const basename = path.basename(originalFileName, extname);
  let destPath = path.join(destDir, originalFileName);
  let counter = 1;
  
  // Check if file already exists
  while (fs.existsSync(destPath)) {
    // Generate unique ID (timestamp + counter)
    const uniqueId = `${Date.now()}_${counter}`;
    const newFileName = `${basename}_${uniqueId}${extname}`;
    destPath = path.join(destDir, newFileName);
    counter++;
  }
  
  return path.basename(destPath);
}

ipcMain.handle('upload-images', async (event, projectPath) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] }],
    title: 'Select Images to Upload',
  });

  if (canceled || !filePaths) return { success: false };

  const destDir = path.join(projectPath, 'unlabeled');
  const renamedFiles = [];

  for (const filePath of filePaths) {
    const originalFileName = path.basename(filePath);
    const uniqueFileName = await generateUniqueFilename(destDir, originalFileName);
    const destPath = path.join(destDir, uniqueFileName);
    
    if (originalFileName !== uniqueFileName) {
      renamedFiles.push({
        original: originalFileName,
        renamed: uniqueFileName
      });
    }
    
    await fsp.copyFile(filePath, destPath);
  }
  
  return { 
    success: true, 
    renamedFiles: renamedFiles.length > 0 ? renamedFiles : null 
  };
});

ipcMain.handle('move-images', async (event, projectPath, filesToMove, fromStage, toStage) => {
  const fromDir = path.join(projectPath, fromStage);
  const toDir = path.join(projectPath, toStage);

  for (const fileName of filesToMove) {
    // Generate unique filename for destination if needed
    const uniqueFileName = await generateUniqueFilename(toDir, fileName);
    const sourceImagePath = path.join(fromDir, fileName);
    const destImagePath = path.join(toDir, uniqueFileName);
    
    // Move image
    try {
      await fsp.rename(sourceImagePath, destImagePath);
    } catch (error) {
      console.error(`Failed to move ${fileName} from ${fromStage} to ${toStage}:`, error);
      continue; // Skip this file and continue with others
    }

    // Move corresponding label file, if it exists
    const originalBaseName = path.basename(fileName, path.extname(fileName));
    const newBaseName = path.basename(uniqueFileName, path.extname(uniqueFileName));
    const sourceLabelName = originalBaseName + '.txt';
    const destLabelName = newBaseName + '.txt';
    
    const sourceLabelPath = path.join(fromDir, sourceLabelName);
    const destLabelPath = path.join(toDir, destLabelName);
    
    try {
      // Check if source label file exists before trying to move it
      if (fs.existsSync(sourceLabelPath)) {
        await fsp.rename(sourceLabelPath, destLabelPath);
      }
    } catch (error) {
      console.error(`Failed to move label for ${fileName}:`, error);
    }
  }
  return true;
});

// Handler to delete all images in the dataset folder
ipcMain.handle('delete-dataset-images', async (event, projectPath) => {
  const datasetDir = path.join(projectPath, 'dataset');
  
  try {
    // Check if dataset directory exists
    if (!fs.existsSync(datasetDir)) {
      return false;
    }

    // Read all files in the dataset directory
    const files = await fsp.readdir(datasetDir);
    
    // Delete all files
    for (const file of files) {
      const filePath = path.join(datasetDir, file);
      try {
        await fsp.unlink(filePath);
      } catch (error) {
        console.error(`Failed to delete file ${file}:`, error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting dataset images:', error);
    return false;
  }
});

// --- Annotation Window Handlers ---

ipcMain.handle('open-annotation-window', (event, projectPath) => {
  projectPathCache = projectPath;
  createAnnotationWindow();
});

ipcMain.handle('close-annotation-window', () => {
  const annotationWindow = BrowserWindow.getAllWindows().find(win => 
    win.webContents.getURL().includes('annotation.html') || 
    win.webContents.getURL().includes('annotation')
  );
  if (annotationWindow) {
    annotationWindow.close();
  }
});

ipcMain.handle('get-annotation-list', async () => {
  if (!projectPathCache) return [];
  const annotationPath = path.join(projectPathCache, 'annotation');
  const files = await fsp.readdir(annotationPath);
  const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
  const labelFiles = new Set(files.filter(f => /\.txt$/i.test(f)).map(f => path.basename(f, '.txt')));

  return imageFiles.map(name => ({
    name,
    isAnnotated: labelFiles.has(path.basename(name, path.extname(name)))
  }));
});

ipcMain.handle('get-image-data', async (event, imageName) => {
  if (!projectPathCache) return null;
  const imagePath = path.join(projectPathCache, 'annotation', imageName);
  const data = await fsp.readFile(imagePath, 'base64');
  return data;
});

// Get current project path (used by annotation window)
ipcMain.handle('get-project-path', async () => {
  return projectPathCache;
});

ipcMain.handle('save-yolo-labels', async (event, imageName, labels) => {
  console.log('💾 [Backend] save-yolo-labels called for:', imageName);
  console.log('📝 [Backend] Labels to save:', labels);

  if (!projectPathCache) {
    console.log('❌ [Backend] No project path cached');
    return;
  }

  const labelName = path.basename(imageName, path.extname(imageName)) + '.txt';
  const labelPath = path.join(projectPathCache, 'annotation', labelName);

  console.log('📁 [Backend] Saving to:', labelPath);

  try {
    await fsp.writeFile(labelPath, labels);
    console.log('✅ [Backend] Labels saved successfully');

    // Verify the file was written
    const verification = await fsp.readFile(labelPath, 'utf-8');
    console.log('✔️ [Backend] Verification - file content:', verification);
  } catch (error) {
    console.error('💥 [Backend] Error saving labels:', error);
  }
});

ipcMain.handle('get-labels', async (event, imageName) => {
  console.log('🔍 [Backend] get-labels called for:', imageName);

  if (!projectPathCache) {
    console.log('❌ [Backend] No project path cached');
    return [];
  }

  const labelName = path.basename(imageName, path.extname(imageName)) + '.txt';
  const labelPath = path.join(projectPathCache, 'annotation', labelName);

  // Try to find the image in different possible locations
  const possibleImagePaths = [
    path.join(projectPathCache, 'unlabeled', imageName),
    path.join(projectPathCache, 'annotation', imageName),
    path.join(projectPathCache, 'dataset', imageName)
  ];

  console.log('📁 [Backend] Looking for label file:', labelPath);
  console.log('🔍 [Backend] Possible image paths:', possibleImagePaths);

  try {
    // Check if label file exists first
    try {
      await fsp.access(labelPath);
      console.log('✅ [Backend] Label file exists');
    } catch (error) {
      console.log('📝 [Backend] No label file found (new image)');
      return [];
    }

    // Find the actual image path
    let imagePath = null;
    for (const possiblePath of possibleImagePaths) {
      try {
        await fsp.access(possiblePath);
        imagePath = possiblePath;
        console.log('📍 [Backend] Found image at:', imagePath);
        break;
      } catch (error) {
        console.log('❌ [Backend] Image not found at:', possiblePath);
      }
    }

    if (!imagePath) {
      console.log('💥 [Backend] Image file not found in any location');
      return [];
    }

    // Get project classes
    console.log('🏷️ [Backend] Loading project classes');
    const { classes } = await getProjectConfig();
    console.log('📋 [Backend] Available classes:', classes);

    // Get image dimensions via nativeImage (Option A)
    console.log('📐 [Backend] Reading image dimensions from:', imagePath);
    const { width: imgW, height: imgH } = await getImageDimensions(imagePath);
    console.log('📏 [Backend] Image dimensions:', { imgW, imgH });

    // Read label content
    console.log('📖 [Backend] Reading label content');
    const content = await fsp.readFile(labelPath, 'utf-8');
    console.log('📄 [Backend] Raw label content:', JSON.stringify(content));

    const lines = content.split('\n').filter(l => l.trim() !== '');
    console.log('📝 [Backend] Parsed lines:', lines);

    const boxes = lines.map((line, index) => {
      console.log(`🔢 [Backend] Processing line ${index}:`, line);
      const parts = line.split(' ').map(parseFloat);

      if (parts.length !== 5 || parts.some(Number.isNaN)) {
        console.log('⚠️ [Backend] Invalid line format, expected 5 numeric parts, got:', parts);
        return null;
      }

      const [classIndex, x_center, y_center, width, height] = parts;
      console.log(`🎯 [Backend] YOLO values: class=${classIndex}, center=(${x_center}, ${y_center}), size=(${width}, ${height})`);

      const boxWidth = width * imgW;
      const boxHeight = height * imgH;
      const x = (x_center * imgW) - (boxWidth / 2);
      const y = (y_center * imgH) - (boxHeight / 2);

      const box = {
        x,
        y,
        width: boxWidth,
        height: boxHeight,
        class: classes[classIndex] || 'unknown'
      };

      console.log(`📦 [Backend] Converted box ${index}:`, box);
      return box;
    }).filter(Boolean);

    console.log('🎯 [Backend] Final boxes array:', boxes);
    return boxes;

  } catch (error) {
    console.error('💥 [Backend] Error in get-labels:', error);
    console.error('📍 [Backend] Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return [];
  }
});

// --- Class Management Handlers ---

const getProjectConfigPath = () => path.join(projectPathCache, 'project.json');

const getProjectConfig = async () => {
  if (!projectPathCache) return { classes: [] };
  const configPath = getProjectConfigPath();
  try {
    const data = await fsp.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If config doesn't exist, return a default
    return { classes: ['person', 'car'] };
  }
};

ipcMain.handle('get-project-classes', async () => {
  const config = await getProjectConfig();
  return config.classes;
});

ipcMain.handle('save-project-classes', async (event, classes) => {
  if (!projectPathCache) return;
  const configPath = getProjectConfigPath();
  const config = { classes };
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2));
});

// --- Dataset Management Handlers ---

const getDatasetsPath = () => path.join(projectPathCache, 'datasets');
const getDatasetConfigPath = () => path.join(projectPathCache, 'datasets.json');

ipcMain.handle('get-datasets', async (event, projectPath) => {
  try {
    const datasetsConfigPath = path.join(projectPath, 'datasets.json');
    const data = await fsp.readFile(datasetsConfigPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If config doesn't exist, return empty array
    return [];
  }
});

ipcMain.handle('create-dataset', async (event, projectPath, datasetConfig) => {
  console.log('📦 [Backend] Creating dataset:', datasetConfig);
  
  try {
    // Create datasets directory if it doesn't exist
    const datasetsDir = path.join(projectPath, 'datasets');
    await fsp.mkdir(datasetsDir, { recursive: true });
    
    // Create dataset-specific directory
    const datasetDir = path.join(datasetsDir, datasetConfig.name);
    await fsp.mkdir(datasetDir, { recursive: true });
    
    // Create train/valid/test directories with images and labels subdirectories
    const splits = ['train', 'valid', 'test'];
    for (const split of splits) {
      const splitDir = path.join(datasetDir, split);
      await fsp.mkdir(splitDir, { recursive: true });
      await fsp.mkdir(path.join(splitDir, 'images'), { recursive: true });
      await fsp.mkdir(path.join(splitDir, 'labels'), { recursive: true });
    }
    
    // Get all images and labels from dataset folder
    const datasetImagesDir = path.join(projectPath, 'dataset');
    const files = await fsp.readdir(datasetImagesDir);
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
    
    console.log('📸 [Backend] Found images:', imageFiles.length);
    
    // Shuffle images for random distribution
    const shuffledImages = [...imageFiles].sort(() => Math.random() - 0.5);
    
    // Calculate split indices
    const totalImages = shuffledImages.length;
    const trainCount = Math.floor(totalImages * datasetConfig.trainSplit / 100);
    const validCount = Math.floor(totalImages * datasetConfig.validSplit / 100);
    const testCount = totalImages - trainCount - validCount;
    
    console.log('📊 [Backend] Split counts:', { trainCount, validCount, testCount });
    
    // Distribute images
    const trainImages = shuffledImages.slice(0, trainCount);
    const validImages = shuffledImages.slice(trainCount, trainCount + validCount);
    const testImages = shuffledImages.slice(trainCount + validCount);
    
    const splitData = {
      train: trainImages,
      valid: validImages,
      test: testImages
    };
    
    // Copy images and labels to respective directories
    for (const [splitName, images] of Object.entries(splitData)) {
      const splitImagesDir = path.join(datasetDir, splitName, 'images');
      const splitLabelsDir = path.join(datasetDir, splitName, 'labels');
      
      for (const imageName of images) {
        // Copy image with unique name if needed
        const uniqueImageName = await generateUniqueFilename(splitImagesDir, imageName);
        const sourceImagePath = path.join(datasetImagesDir, imageName);
        const destImagePath = path.join(splitImagesDir, uniqueImageName);
        await fsp.copyFile(sourceImagePath, destImagePath);
        
        // Copy corresponding label file if it exists
        const originalBaseName = path.basename(imageName, path.extname(imageName));
        const newBaseName = path.basename(uniqueImageName, path.extname(uniqueImageName));
        const sourceLabelName = originalBaseName + '.txt';
        const destLabelName = newBaseName + '.txt';
        const sourceLabelPath = path.join(datasetImagesDir, sourceLabelName);
        const destLabelPath = path.join(splitLabelsDir, destLabelName);
        
        try {
          if (fs.existsSync(sourceLabelPath)) {
            await fsp.copyFile(sourceLabelPath, destLabelPath);
          }
        } catch (error) {
          console.log(`⚠️ [Backend] No label file for ${imageName}`);
        }
      }
    }
    
    // Update datasets configuration
    const datasetsConfigPath = path.join(projectPath, 'datasets.json');
    let datasets = [];
    try {
      const data = await fsp.readFile(datasetsConfigPath, 'utf-8');
      datasets = JSON.parse(data);
    } catch (error) {
      // File doesn't exist, start with empty array
    }
    
    const newDataset = {
      name: datasetConfig.name,
      path: datasetDir,
      trainSplit: datasetConfig.trainSplit,
      validSplit: datasetConfig.validSplit,
      testSplit: datasetConfig.testSplit,
      totalImages: totalImages,
      createdAt: new Date().toISOString()
    };
    
    datasets.push(newDataset);
    await fsp.writeFile(datasetsConfigPath, JSON.stringify(datasets, null, 2));
    
    console.log('✅ [Backend] Dataset created successfully');
    return true;
    
  } catch (error) {
    console.error('💥 [Backend] Error creating dataset:', error);
    return false;
  }
});

ipcMain.handle('delete-dataset', async (event, projectPath, datasetName) => {
  console.log('🗑️ [Backend] Deleting dataset:', datasetName);
  
  try {
    // Remove dataset directory
    const datasetDir = path.join(projectPath, 'datasets', datasetName);
    await fsp.rm(datasetDir, { recursive: true, force: true });
    
    // Update datasets configuration
    const datasetsConfigPath = path.join(projectPath, 'datasets.json');
    let datasets = [];
    try {
      const data = await fsp.readFile(datasetsConfigPath, 'utf-8');
      datasets = JSON.parse(data);
    } catch (error) {
      return true; // If config doesn't exist, consider it deleted
    }
    
    datasets = datasets.filter(dataset => dataset.name !== datasetName);
    await fsp.writeFile(datasetsConfigPath, JSON.stringify(datasets, null, 2));
    
    console.log('✅ [Backend] Dataset deleted successfully');
    return true;
    
  } catch (error) {
    console.error('💥 [Backend] Error deleting dataset:', error);
    return false;
  }
});

// --- Model Management Handlers ---

// Get models
ipcMain.handle('get-models', async (event, projectPath) => {
  try {
    const modelsPath = path.join(projectPath, 'models.json');
    
    if (!fs.existsSync(modelsPath)) {
      return [];
    }
    
    const modelsData = await fsp.readFile(modelsPath, 'utf8');
    return JSON.parse(modelsData);
  } catch (error) {
    console.error('Error getting models:', error);
    return [];
  }
});

// Create model
ipcMain.handle('create-model', async (event, projectPath, modelConfig) => {
  try {
    const modelsPath = path.join(projectPath, 'models.json');
    let models = [];
    
    if (fs.existsSync(modelsPath)) {
      const modelsData = await fsp.readFile(modelsPath, 'utf8');
      models = JSON.parse(modelsData);
    }
    
    // Generate unique ID for the model if not provided
    const modelId = modelConfig.id || Date.now().toString();
    
    // Convert frontend model structure to backend structure
    const newModel = {
      id: modelId,
      name: modelConfig.name,
      version: modelConfig.version || 'v1.0',
      endpoint: modelConfig.endpoint,
      headers: {},
      confidence: 0.5,
      description: modelConfig.description || '',
      createdAt: modelConfig.createdAt || new Date().toISOString()
    };
    
    // Add authentication headers if authToken is provided
    if (modelConfig.authToken && modelConfig.authToken.trim()) {
      newModel.headers['Authorization'] = `Bearer ${modelConfig.authToken.trim()}`;
    }
    
    models.push(newModel);
    
    await fsp.writeFile(modelsPath, JSON.stringify(models, null, 2));
    console.log(`Model ${modelConfig.name} created successfully`);
    
    return { success: true, model: newModel };
  } catch (error) {
    console.error('Error creating model:', error);
    return { success: false, error: error.message };
  }
});

// Delete model
ipcMain.handle('delete-model', async (event, projectPath, modelId) => {
  try {
    const modelsPath = path.join(projectPath, 'models.json');
    
    if (!fs.existsSync(modelsPath)) {
      return { success: false, error: 'Models file not found' };
    }
    
    const modelsData = await fsp.readFile(modelsPath, 'utf8');
    let models = JSON.parse(modelsData);
    
    const initialLength = models.length;
    models = models.filter(model => model.id !== modelId);
    
    if (models.length === initialLength) {
      return { success: false, error: 'Model not found' };
    }
    
    await fsp.writeFile(modelsPath, JSON.stringify(models, null, 2));
    console.log(`Model ${modelId} deleted successfully`);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting model:', error);
    return { success: false, error: error.message };
  }
});

// Predict with model
ipcMain.handle('predict-with-model', async (event, projectPath, modelId, imageData) => {
  try {
    const modelsPath = path.join(projectPath, 'models.json');
    
    if (!fs.existsSync(modelsPath)) {
      return { success: false, error: 'Models file not found' };
    }
    
    const modelsData = await fsp.readFile(modelsPath, 'utf8');
    const models = JSON.parse(modelsData);
    
    const model = models.find(m => m.id === modelId);
    if (!model) {
      return { success: false, error: 'Model not found' };
    }
    
    // Import fetch dynamically for HTTP requests
    const { default: fetch } = await import('node-fetch');
    const FormData = (await import('form-data')).default;
    
    // Create FormData for the image upload
    const formData = new FormData();
    
    // Handle different image data formats
    let imageBuffer;
    if (imageData instanceof Buffer) {
      imageBuffer = imageData;
    } else if (typeof imageData === 'string' && imageData.startsWith('data:')) {
      // Handle base64 data URL
      const base64Data = imageData.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      // Handle Blob/ArrayBuffer from frontend
      imageBuffer = Buffer.from(imageData);
    }
    
    // Append image as file upload (matching FastAPI's UploadFile expectation)
    formData.append('file', imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg'
    });
    
    // Add any additional parameters from the model config
    if (model.confidence) {
      formData.append('confidence', model.confidence.toString());
    }
    
    // Prepare headers
    const headers = {
      ...formData.getHeaders()
    };
    
    // Add authentication headers if available
    if (model.headers && Object.keys(model.headers).length > 0) {
      Object.assign(headers, model.headers);
    }
    
    console.log(`Making prediction request to: ${model.endpoint}`);
    
    // Make the API request
    const response = await fetch(model.endpoint, {
      method: 'POST',
      body: formData,
      headers: headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const result = await response.json();
    
    // Your FastAPI server returns: { predictions: [...] }
    // Extract the predictions array
    const predictions = result.predictions || result;
    
    console.log(`Received ${predictions.length} predictions from model`);
    
    return { success: true, predictions: predictions };
  } catch (error) {
    console.error('Error making prediction:', error);
    return { success: false, error: error.message };
  }
});

// --- Window Management Handlers ---

ipcMain.on('window-minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize();
});

ipcMain.on('window-maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win?.isMaximized()) win.unmaximize();
    else win?.maximize();
});

ipcMain.on('window-close', () => {
    BrowserWindow.getFocusedWindow()?.close();
});
