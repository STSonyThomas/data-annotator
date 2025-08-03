// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Main window functions
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  createProject: () => ipcRenderer.invoke('create-project'),
  openProject: () => ipcRenderer.invoke('open-project'),
  listProjectFiles: (projectPath) => ipcRenderer.invoke('list-project-files', projectPath),
  uploadImages: (projectPath) => ipcRenderer.invoke('upload-images', projectPath),
  moveImages: (projectPath, files, fromStage, toStage) => ipcRenderer.invoke('move-images', projectPath, files, fromStage, toStage),
  deleteDatasetImages: (projectPath) => ipcRenderer.invoke('delete-dataset-images', projectPath),
  openAnnotationWindow: (projectPath) => ipcRenderer.invoke('open-annotation-window', projectPath),
  closeAnnotationWindow: () => ipcRenderer.invoke('close-annotation-window'),

  // Annotation window functions
  getAnnotationList: () => ipcRenderer.invoke('get-annotation-list'),
  getImageData: (imageName) => ipcRenderer.invoke('get-image-data', imageName),
  getProjectPath: () => ipcRenderer.invoke('get-project-path'),
  saveYoloLabels: (imageName, labels) => ipcRenderer.invoke('save-yolo-labels', imageName, labels),
  getLabels: (imageName) => ipcRenderer.invoke('get-labels', imageName),
  
  // Class management functions
  getProjectClasses: () => ipcRenderer.invoke('get-project-classes'),
  saveProjectClasses: (classes) => ipcRenderer.invoke('save-project-classes', classes),
  
  // Dataset management functions
  getDatasets: (projectPath) => ipcRenderer.invoke('get-datasets', projectPath),
  createDataset: (projectPath, datasetConfig) => ipcRenderer.invoke('create-dataset', projectPath, datasetConfig),
  deleteDataset: (projectPath, datasetName) => ipcRenderer.invoke('delete-dataset', projectPath, datasetName),
  
  // Model management functions
  getModels: (projectPath) => ipcRenderer.invoke('get-models', projectPath),
  createModel: (projectPath, modelConfig) => ipcRenderer.invoke('create-model', projectPath, modelConfig),
  deleteModel: (projectPath, modelId) => ipcRenderer.invoke('delete-model', projectPath, modelId),
  predictWithModel: (projectPath, modelId, imageData) => ipcRenderer.invoke('predict-with-model', projectPath, modelId, imageData),
});
