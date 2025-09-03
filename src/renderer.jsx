// src/renderer.jsx

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

const App = () => {
  const [project, setProject] = useState(null);

  const handleCreateProject = async () => {
    const newProject = await window.electronAPI.createProject();
    if (newProject) setProject(newProject);
  };

  const handleOpenProject = async () => {
    const projectData = await window.electronAPI.openProject();
    if (projectData) setProject(projectData);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e', color: 'white' }}>
      {project ? (
        <ProjectView project={project} />
      ) : (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          flex: 1, 
          textAlign: 'center', 
          paddingTop: '30px' 
        }}>
          <div className="window-controls" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', backgroundColor: '#2c2c2c', borderBottom: '1px solid #555', zIndex: 9999 }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'white' }}>Data Labeler</span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={() => window.electronAPI.minimize()} style={{ padding: '2px 8px', fontSize: '12px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '3px' }}>_</button>
              <button onClick={() => window.electronAPI.maximize()} style={{ padding: '2px 8px', fontSize: '12px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '3px' }}>▢</button>
              <button onClick={() => window.electronAPI.close()} style={{ padding: '2px 8px', fontSize: '12px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '3px' }}>✕</button>
            </div>
          </div>
          <h1 style={{ color: 'white', marginBottom: '20px', fontSize: '2.5rem' }}>Welcome to Data Labeler</h1>
          <p style={{ color: '#ccc', marginBottom: '30px', fontSize: '1.1rem' }}>Create or open a project to start annotating your images</p>
          <div style={{ marginTop: '30px' }}>
            <button 
              onClick={handleCreateProject} 
              style={{ 
                marginRight: '15px', 
                padding: '12px 24px', 
                fontSize: '16px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              Create New Project
            </button>
            <button 
              onClick={handleOpenProject} 
              style={{ 
                padding: '12px 24px', 
                fontSize: '16px',
                backgroundColor: '#2ecc71',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              Open Existing Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ProjectView = ({ project }) => {
  const [files, setFiles] = useState({
    unlabeled: { images: [] },
    annotation: { images: [] },
    dataset: { images: [] }
  });
  const [selectedFiles, setSelectedFiles] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [datasets, setDatasets] = useState([]);
  const [showDatasetModal, setShowDatasetModal] = useState(false);
  const [models, setModels] = useState([]);
  const [showModelModal, setShowModelModal] = useState(false);
  const [editingModel, setEditingModel] = useState(null);

  const fetchFiles = async () => {
    if (!project || !project.path) return;
    const projectFiles = await window.electronAPI.listProjectFiles(project.path);
    if (projectFiles) {
      setFiles(projectFiles);
    }
    setSelectedFiles({});
  };

  const fetchDatasets = async () => {
    if (!project || !project.path) return;
    try {
      const datasetList = await window.electronAPI.getDatasets(project.path);
      setDatasets(datasetList || []);
    } catch (error) {
      console.error('Error fetching datasets:', error);
      setDatasets([]);
    }
  };

  const fetchModels = async () => {
    if (!project || !project.path) return;
    try {
      const modelList = await window.electronAPI.getModels(project.path);
      setModels(modelList || []);
    } catch (error) {
      console.error('Error fetching models:', error);
      setModels([]);
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchDatasets();
    fetchModels();
    // Add a listener to refresh the file list when the main window regains focus
    const handleFocus = () => {
      fetchFiles();
      fetchDatasets();
      fetchModels();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [project]);

  const handleUpload = async () => {
    const result = await window.electronAPI.uploadImages(project.path);
    if (result && result.success) {
      fetchFiles();
      
      // Show notification if any files were renamed due to duplicates
      if (result.renamedFiles) {
        const renamedCount = result.renamedFiles.length;
        const message = `${renamedCount} file${renamedCount > 1 ? 's were' : ' was'} renamed to avoid duplicates:\n` +
          result.renamedFiles.map(f => `• ${f.original} → ${f.renamed}`).join('\n');
        alert(`Files uploaded successfully!\n\n${message}`);
      }
    }
  };

  const handleMove = async (fromStage, toStage) => {
    const filesToMove = selectedFiles[fromStage] || [];
    if (filesToMove.length === 0) return;

    const success = await window.electronAPI.moveImages(project.path, filesToMove, fromStage, toStage);
    if (success) fetchFiles();
  };

  const handleMoveAll = async (fromStage, toStage) => {
    const allFiles = files[fromStage]?.images?.map(f => f.name) || [];
    if (allFiles.length === 0) return;

    const success = await window.electronAPI.moveImages(project.path, allFiles, fromStage, toStage);
    if (success) fetchFiles();
  };

  const handleMoveAnnotated = async () => {
    const annotatedFileNames = files.annotation.images
      .filter(f => f.isAnnotated)
      .map(f => f.name);

    if (annotatedFileNames.length === 0) {
      console.log("No annotated files to move.");
      return;
    }

    const success = await window.electronAPI.moveImages(project.path, annotatedFileNames, 'annotation', 'dataset');
    if (success) fetchFiles();
  };

  const handleLabel = () => {
    if (files.annotation.images.length > 0) {
      window.electronAPI.openAnnotationWindow(project.path);
    } else {
      console.log("No files in 'To Annotate' to label.");
    }
  };

  const handleDeleteAllDatasetImages = async () => {
    const datasetImages = files.dataset?.images || [];
    if (datasetImages.length === 0) {
      alert('No images in dataset to delete.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete all ${datasetImages.length} image(s) from the dataset? This will permanently delete the files and cannot be undone.`
    );

    if (confirmed) {
      try {
        const success = await window.electronAPI.deleteDatasetImages(project.path);
        if (success) {
          fetchFiles();
          alert('All dataset images have been deleted successfully.');
        } else {
          alert('Failed to delete dataset images. Please try again.');
        }
      } catch (error) {
        console.error('Error deleting dataset images:', error);
        alert('An error occurred while deleting dataset images.');
      }
    }
  };

  const handleDeleteAllUnlabeledImages = async () => {
    const unlabeledImages = files.unlabeled?.images || [];
    if (unlabeledImages.length === 0) {
      alert('No images in unlabeled to delete.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete all ${unlabeledImages.length} image(s) from unlabeled? This will permanently delete the files and cannot be undone.`
    );

    if (confirmed) {
      try {
        const success = await window.electronAPI.deleteUnlabeledImages(project.path);
        if (success) {
          fetchFiles();
          alert('All unlabeled images have been deleted successfully.');
        } else {
          alert('Failed to delete unlabeled images. Please try again.');
        }
      } catch (error) {
        console.error('Error deleting unlabeled images:', error);
        alert('An error occurred while deleting unlabeled images.');
      }
    }
  };

  const handleCreateDataset = async (datasetConfig) => {
    try {
      const success = await window.electronAPI.createDataset(project.path, datasetConfig);
      if (success) {
        fetchDatasets();
        setShowDatasetModal(false);
      }
    } catch (error) {
      console.error('Error creating dataset:', error);
      alert('Failed to create dataset. Please try again.');
    }
  };

  const handleDeleteDataset = async (datasetName) => {
    if (window.confirm(`Are you sure you want to delete dataset "${datasetName}"? This action cannot be undone.`)) {
      try {
        const success = await window.electronAPI.deleteDataset(project.path, datasetName);
        if (success) {
          fetchDatasets();
        }
      } catch (error) {
        console.error('Error deleting dataset:', error);
        alert('Failed to delete dataset. Please try again.');
      }
    }
  };

  const handleCreateModel = async (modelConfig) => {
    try {
      const result = await window.electronAPI.createModel(project.path, modelConfig);
      if (result.success) {
        fetchModels();
        setShowModelModal(false);
        setEditingModel(null);
      } else {
        alert('Failed to create model: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating model:', error);
      alert('Failed to create model. Please try again.');
    }
  };

  const handleEditModel = (model) => {
    setEditingModel(model);
    setShowModelModal(true);
  };

  const handleDeleteModel = async (modelId) => {
    if (window.confirm(`Are you sure you want to delete this model? This action cannot be undone.`)) {
      try {
        const result = await window.electronAPI.deleteModel(project.path, modelId);
        if (result.success) {
          fetchModels();
        } else {
          alert('Failed to delete model: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting model:', error);
        alert('Failed to delete model. Please try again.');
      }
    }
  };

  const toggleSelection = (stage, fileName) => {
    const currentSelection = selectedFiles[stage] || [];
    const newSelection = currentSelection.includes(fileName)
      ? currentSelection.filter(f => f !== fileName)
      : [...currentSelection, fileName];
    setSelectedFiles({ ...selectedFiles, [stage]: newSelection });
  };

  // Dataset Modal Component
  const DatasetModal = ({ isOpen, onClose, onSubmit, totalImages }) => {
    const [datasetName, setDatasetName] = useState('');
    const [trainSplit, setTrainSplit] = useState(70);
    const [validSplit, setValidSplit] = useState(20);
    const [testSplit, setTestSplit] = useState(10);

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!datasetName.trim()) {
        alert('Please enter a dataset name');
        return;
      }
      if (trainSplit + validSplit + testSplit !== 100) {
        alert('Train, Validation, and Test splits must add up to 100%');
        return;
      }
      onSubmit({
        name: datasetName.trim(),
        trainSplit,
        validSplit,
        testSplit
      });
    };

    if (!isOpen) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}>
        <div style={{
          backgroundColor: '#2c2c2c',
          padding: '30px',
          borderRadius: '10px',
          border: '1px solid #555',
          minWidth: '400px',
          color: 'white'
        }}>
          <h2 style={{ margin: '0 0 20px 0', color: 'white' }}>Create Dataset</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Dataset Name:</label>
              <input
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#404040',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: 'white'
                }}
                placeholder="e.g., dataset-v1"
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <p style={{ color: '#ccc', margin: '0 0 10px 0' }}>Total Images: {totalImages}</p>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Train Split (%):</label>
              <input
                type="number"
                value={trainSplit}
                onChange={(e) => setTrainSplit(parseInt(e.target.value) || 0)}
                min="0"
                max="100"
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#404040',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: 'white'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Validation Split (%):</label>
              <input
                type="number"
                value={validSplit}
                onChange={(e) => setValidSplit(parseInt(e.target.value) || 0)}
                min="0"
                max="100"
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#404040',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: 'white'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Test Split (%):</label>
              <input
                type="number"
                value={testSplit}
                onChange={(e) => setTestSplit(parseInt(e.target.value) || 0)}
                min="0"
                max="100"
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#404040',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: 'white'
                }}
              />
            </div>

            <div style={{ 
              color: trainSplit + validSplit + testSplit === 100 ? '#27ae60' : '#e74c3c',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              Total: {trainSplit + validSplit + testSplit}%
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#555',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Create Dataset
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Model Modal Component
  const ModelModal = ({ isOpen, onClose, onSubmit, editingModel }) => {
    const [modelName, setModelName] = useState('');
    const [modelVersion, setModelVersion] = useState('');
    const [endpoint, setEndpoint] = useState('');
    const [authToken, setAuthToken] = useState('');

    useEffect(() => {
      if (editingModel) {
        setModelName(editingModel.name || '');
        setModelVersion(editingModel.version || '');
        setEndpoint(editingModel.endpoint || '');
        setAuthToken(editingModel.authToken || '');
      } else {
        setModelName('');
        setModelVersion('');
        setEndpoint('');
        setAuthToken('');
      }
    }, [editingModel]);

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!modelName.trim()) {
        alert('Please enter a model name');
        return;
      }
      if (!endpoint.trim()) {
        alert('Please enter an endpoint URL');
        return;
      }
      
      // Basic URL validation
      try {
        new URL(endpoint);
      } catch (e) {
        alert('Please enter a valid URL');
        return;
      }

      onSubmit({
        id: editingModel ? editingModel.id : Date.now().toString(),
        name: modelName.trim(),
        version: modelVersion.trim() || 'v1.0',
        endpoint: endpoint.trim(),
        authToken: authToken.trim(),
        createdAt: editingModel ? editingModel.createdAt : new Date().toISOString()
      });
    };

    if (!isOpen) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}>
        <div style={{
          backgroundColor: '#2c2c2c',
          padding: '30px',
          borderRadius: '10px',
          border: '1px solid #555',
          minWidth: '500px',
          color: 'white'
        }}>
          <h2 style={{ margin: '0 0 20px 0', color: 'white' }}>
            {editingModel ? 'Edit Model' : 'Add Model'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Model Name:</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#404040',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: 'white'
                }}
                placeholder="e.g., YOLOv8 Object Detection"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Version:</label>
              <input
                type="text"
                value={modelVersion}
                onChange={(e) => setModelVersion(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#404040',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: 'white'
                }}
                placeholder="e.g., v1.0, v2.1"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Endpoint URL:</label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#404040',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: 'white'
                }}
                placeholder="https://api.example.com/predict"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Auth Token (Optional):</label>
              <input
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#404040',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: 'white'
                }}
                placeholder="Bearer token or API key"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setEditingModel(null);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#555',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {editingModel ? 'Update Model' : 'Add Model'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const StageColumn = ({ stage, title, onMoveLeft, onMoveRight, onMoveAll, onLabel, onMoveAnnotated, onCreateDataset, onDeleteAll }) => {
    const images = files[stage]?.images || [];
    const displayedImages = images.slice(0, 4);
    const remainingCount = Math.max(0, images.length - 4);

    return (
      <div style={{ 
        flex: 1, 
        border: '1px solid #555', 
        borderRadius: '8px', 
        display: 'flex', 
        flexDirection: 'column', 
        backgroundColor: '#2c2c2c',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          borderBottom: '1px solid #555', 
          padding: '15px',
          backgroundColor: '#3c3c3c',
          borderRadius: '8px 8px 0 0'
        }}>
          <h3 style={{ 
            textAlign: 'center', 
            margin: 0, 
            marginRight: '10px', 
            color: 'white',
            fontSize: '1.1rem'
          }}>
            {title} ({images.length})
          </h3>
          {onLabel && (
            <button 
              onClick={onLabel} 
              disabled={images.length === 0}
              style={{
                padding: '8px 12px',
                backgroundColor: images.length === 0 ? '#555' : '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: images.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '12px'
              }}
            >
              🏷️ Label Images
            </button>
          )}
          {onCreateDataset && (
            <button 
              onClick={onCreateDataset} 
              disabled={images.length === 0}
              style={{
                padding: '8px 12px',
                backgroundColor: images.length === 0 ? '#555' : '#9b59b6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: images.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                marginRight: '8px'
              }}
            >
              📦 Create Dataset
            </button>
          )}
          {onDeleteAll && (
            <button 
              onClick={onDeleteAll} 
              disabled={images.length === 0}
              style={{
                padding: '8px 12px',
                backgroundColor: images.length === 0 ? '#555' : '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: images.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '12px'
              }}
            >
              🗑️ Delete All
            </button>
          )}
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '5px' }}>
          {displayedImages.map(fileInfo => {
            // Truncate filename to first 10 characters + extension
            const truncatedName = fileInfo.name.length > 14 
              ? fileInfo.name.substring(0, 10) + '...' + fileInfo.name.substring(fileInfo.name.lastIndexOf('.'))
              : fileInfo.name;
            
            return (
              <div
                key={fileInfo.name}
                onClick={() => toggleSelection(stage, fileInfo.name)}
                title={fileInfo.name} // Show full name on hover
                style={{
                  padding: '8px',
                  margin: '2px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  backgroundColor: (selectedFiles[stage] || []).includes(fileInfo.name) ? '#3498db' : '#404040',
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #555',
                  color: 'white',
                  transition: 'background-color 0.2s'
                }}
              >
                {fileInfo.isAnnotated && <span style={{ color: 'green', marginRight: '8px', fontSize: '16px' }}>✔</span>}
                <span style={{ opacity: fileInfo.isAnnotated ? 1 : 0.7 }}>{truncatedName}</span>
              </div>
            );
          })}
          {remainingCount > 0 && (
            <div
              style={{
                padding: '12px',
                margin: '2px',
                borderRadius: '4px',
                backgroundColor: '#505050',
                border: '2px dashed #777',
                textAlign: 'center',
                color: '#ccc',
                fontSize: '14px',
                fontStyle: 'italic'
              }}
            >
              ... and {remainingCount} more image{remainingCount === 1 ? '' : 's'}
            </div>
          )}
        </div>
        <div style={{ 
          padding: '10px', 
          borderTop: '1px solid #555', 
          display: 'flex', 
          justifyContent: 'space-between', 
          gap: '5px',
          backgroundColor: '#3c3c3c',
          borderRadius: '0 0 8px 8px'
        }}>
          {onMoveLeft && (
            <button 
              onClick={onMoveLeft}
              style={{
                padding: '6px 12px',
                backgroundColor: '#f39c12',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ← Move All
            </button>
          )}
          {onMoveAll && (
            <button 
              onClick={onMoveAll}
              disabled={images.length === 0}
              style={{
                padding: '6px 12px',
                backgroundColor: images.length === 0 ? '#555' : '#2ecc71',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: images.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '12px'
              }}
            >
              Move All →
            </button>
          )}
          <div style={{ flex: 1 }}></div>
          {onMoveAnnotated && (
            <button 
              onClick={onMoveAnnotated}
              style={{
                padding: '6px 12px',
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Move Annotated →
            </button>
          )}
          {onMoveRight && (
            <button 
              onClick={onMoveRight}
              style={{
                padding: '6px 12px',
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Move Selected →
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#1e1e1e', color: 'white' }}>
      <div className="window-controls" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', backgroundColor: '#2c2c2c', borderBottom: '1px solid #555', zIndex: 9999 }}>
        <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'white' }}>Data Labeler</span>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={() => window.electronAPI.minimize()} style={{ padding: '2px 8px', fontSize: '12px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '3px' }}>_</button>
          <button onClick={() => window.electronAPI.maximize()} style={{ padding: '2px 8px', fontSize: '12px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '3px' }}>▢</button>
          <button onClick={() => window.electronAPI.close()} style={{ padding: '2px 8px', fontSize: '12px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '3px' }}>✕</button>
        </div>
      </div>
      
      <div style={{ display: 'flex', flex: 1, marginTop: '30px' }}>
        {/* Sidebar */}
        <div style={{ 
          width: '200px', 
          backgroundColor: '#2c2c2c', 
          borderRight: '1px solid #555',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #555' }}>
            <h3 style={{ margin: '0 0 5px 0', color: 'white', fontSize: '1.2rem' }}>{project.name}</h3>
            <p style={{ margin: '0', color: '#ccc', fontSize: '0.8rem' }}>Project</p>
          </div>
          
          <div style={{ flex: 1 }}>
            <button
              onClick={() => setActiveTab('overview')}
              style={{
                width: '100%',
                padding: '15px 20px',
                backgroundColor: activeTab === 'overview' ? '#3498db' : 'transparent',
                color: 'white',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                borderBottom: '1px solid #555'
              }}
            >
              📊 Overview
            </button>
            <button
              onClick={() => setActiveTab('datasets')}
              style={{
                width: '100%',
                padding: '15px 20px',
                backgroundColor: activeTab === 'datasets' ? '#3498db' : 'transparent',
                color: 'white',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                borderBottom: '1px solid #555'
              }}
            >
              📦 Datasets ({datasets.length})
            </button>
            <button
              onClick={() => setActiveTab('models')}
              style={{
                width: '100%',
                padding: '15px 20px',
                backgroundColor: activeTab === 'models' ? '#3498db' : 'transparent',
                color: 'white',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                borderBottom: '1px solid #555'
              }}
            >
              🤖 Models ({models.length})
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'overview' ? (
            <>
              <div style={{ 
                padding: '20px', 
                borderBottom: '1px solid #555', 
                backgroundColor: '#2c2c2c'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                  <p style={{ color: '#ccc', margin: '0', fontSize: '0.9rem' }}>{project.path}</p>
                  <button 
                    onClick={handleUpload}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      marginTop: '5px'
                    }}
                  >
                    📁 Upload Images
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flex: 1, padding: '10px', gap: '10px' }}>
                <StageColumn
                  stage="unlabeled"
                  title="Unlabeled"
                  onMoveRight={() => handleMove('unlabeled', 'annotation')}
                  onMoveAll={() => handleMoveAll('unlabeled', 'annotation')}
                  onDeleteAll={handleDeleteAllUnlabeledImages}
                />
                <StageColumn
                  stage="annotation"
                  title="To Annotate"
                  onMoveLeft={() => handleMoveAll('annotation', 'unlabeled')}
                  onMoveRight={() => handleMove('annotation', 'dataset')}
                  onLabel={handleLabel}
                  onMoveAnnotated={handleMoveAnnotated}
                />
                <StageColumn
                  stage="dataset"
                  title="Dataset"
                  onMoveLeft={() => handleMove('dataset', 'annotation')}
                  onCreateDataset={() => setShowDatasetModal(true)}
                  onDeleteAll={handleDeleteAllDatasetImages}
                />
              </div>
            </>
          ) : activeTab === 'datasets' ? (
            /* Datasets Tab */
            <div style={{ flex: 1, padding: '20px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ color: 'white', margin: '0 0 10px 0', fontSize: '1.5rem' }}>Dataset Versions</h2>
                <p style={{ color: '#ccc', margin: '0', fontSize: '0.9rem' }}>
                  Manage your created datasets with train/validation/test splits
                </p>
              </div>
              
              {datasets.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px', 
                  color: '#666',
                  backgroundColor: '#2c2c2c',
                  borderRadius: '8px',
                  border: '2px dashed #555'
                }}>
                  <p style={{ fontSize: '1.1rem', marginBottom: '10px' }}>No datasets created yet</p>
                  <p style={{ fontSize: '0.9rem' }}>Move images to the Dataset column and click "Create Dataset" to get started</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                  {datasets.map((dataset, index) => (
                    <div 
                      key={index}
                      style={{
                        backgroundColor: '#2c2c2c',
                        border: '1px solid #555',
                        borderRadius: '8px',
                        padding: '20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.2rem' }}>{dataset.name}</h3>
                        <p style={{ margin: '0 0 5px 0', color: '#ccc', fontSize: '0.85rem' }}>{dataset.path}</p>
                        <div style={{ display: 'flex', gap: '15px', fontSize: '0.8rem', color: '#999' }}>
                          <span>Train: {dataset.trainSplit}%</span>
                          <span>Valid: {dataset.validSplit}%</span>
                          <span>Test: {dataset.testSplit}%</span>
                          <span>Total Images: {dataset.totalImages}</span>
                        </div>
                        <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '0.75rem' }}>
                          Created: {new Date(dataset.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteDataset(dataset.name)}
                        style={{
                          padding: '8px 15px',
                          backgroundColor: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'models' ? (
            /* Models Tab */
            <div style={{ flex: 1, padding: '20px' }}>
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ color: 'white', margin: '0 0 10px 0', fontSize: '1.5rem' }}>AI Models</h2>
                  <p style={{ color: '#ccc', margin: '0', fontSize: '0.9rem' }}>
                    Manage model endpoints for automatic annotation
                  </p>
                </div>
                <button
                  onClick={() => setShowModelModal(true)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}
                >
                  🤖 Add Model
                </button>
              </div>
              
              {models.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px', 
                  color: '#666',
                  backgroundColor: '#2c2c2c',
                  borderRadius: '8px',
                  border: '2px dashed #555'
                }}>
                  <p style={{ fontSize: '1.1rem', marginBottom: '10px' }}>No models configured yet</p>
                  <p style={{ fontSize: '0.9rem' }}>Add model endpoints to enable automatic annotation</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                  {models.map((model, index) => (
                    <div 
                      key={model.id || index}
                      style={{
                        backgroundColor: '#2c2c2c',
                        border: '1px solid #555',
                        borderRadius: '8px',
                        padding: '20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.2rem' }}>
                          {model.name}
                          <span style={{ fontSize: '0.8rem', color: '#999', marginLeft: '10px' }}>
                            {model.version}
                          </span>
                        </h3>
                        <p style={{ margin: '0 0 5px 0', color: '#ccc', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                          {model.endpoint}
                        </p>
                        <div style={{ display: 'flex', gap: '15px', fontSize: '0.8rem', color: '#999' }}>
                          <span>Auth: {model.authToken ? 'Yes' : 'No'}</span>
                          <span>Added: {new Date(model.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => handleEditModel(model)}
                          style={{
                            padding: '8px 15px',
                            backgroundColor: '#f39c12',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteModel(model.id)}
                          style={{
                            padding: '8px 15px',
                            backgroundColor: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Default fallback */
            <div style={{ flex: 1, padding: '20px' }}>
              <p style={{ color: '#ccc' }}>Select a tab to view content</p>
            </div>
          )}
        </div>
      </div>

      {/* Dataset Modal */}
      <DatasetModal 
        isOpen={showDatasetModal}
        onClose={() => setShowDatasetModal(false)}
        onSubmit={handleCreateDataset}
        totalImages={files.dataset?.images?.length || 0}
      />

      {/* Model Modal */}
      <ModelModal 
        isOpen={showModelModal}
        onClose={() => setShowModelModal(false)}
        onSubmit={handleCreateModel}
        editingModel={editingModel}
      />
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<React.StrictMode><App /></React.StrictMode>);
