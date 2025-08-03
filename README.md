# Data Labeler

A comprehensive desktop application for image annotation and dataset management, built with Electron and React. This tool provides an intuitive interface for creating, managing, and organizing computer vision datasets with YOLO format annotations.

## 🚀 Features

### Project Management
- **Create New Projects**: Initialize new annotation projects with dedicated folder structures
- **Open Existing Projects**: Resume work on previously created projects
- **Project Overview**: Visual dashboard showing project statistics and file organization

### Image Management Workflow
- **Three-Stage Pipeline**: Organize images through Unlabeled → To Annotate → Dataset stages
- **Bulk Upload**: Import multiple images at once into your project
- **Smart File Movement**: 
  - Move individual selected images between stages
  - **Move All**: Bulk transfer all images from Unlabeled to To Annotate stage
  - **Move Annotated**: Automatically move completed annotations to Dataset stage
- **File Preview**: Truncated filename display with hover tooltips for full names
- **Visual Indicators**: Green checkmarks show which images have been annotated

### Advanced Annotation Tools
- **Dual-Mode Interface**: Switch between Draw and Select modes
  - **Draw Mode**: Create new bounding boxes with class assignment
  - **Select Mode**: Click and edit existing bounding boxes
- **Individual Box Editing**: 
  - Select any bounding box for modification
  - Change class labels on individual boxes
  - Delete specific bounding boxes
  - Real-time visual feedback during selection
- **Interactive Canvas**: Smooth drawing experience with mouse controls
- **Class Management**: Define and assign custom classes to annotations
- **YOLO Format**: Export annotations in industry-standard YOLO format

### Dataset Creation & Management
- **Intelligent Dataset Splitting**: Create train/validation/test splits with customizable percentages
- **Dataset Versioning**: Create multiple dataset versions with different configurations
- **Automated File Organization**: 
  - Separate folders for images and labels
  - Proper YOLO directory structure (train/valid/test)
  - Automatic file copying and organization
- **Dataset Overview**: Tabbed interface showing all created datasets with metadata
- **Dataset Deletion**: Remove unwanted dataset versions with confirmation dialogs

### User Interface & Experience
- **Modern Dark Theme**: Professional dark interface optimized for long annotation sessions
- **Sidebar Navigation**: Organized tabs for Overview and Datasets management
- **Custom Window Controls**: Branded title bar with minimize/maximize/close buttons
- **Responsive Layout**: Adaptive interface that works across different screen sizes
- **Real-time Updates**: Automatic refresh of file lists and project status
- **Modal Dialogs**: Clean interfaces for dataset creation and configuration

## 🛠️ Technology Stack

- **Frontend**: React 18 with functional components and hooks
- **Desktop Framework**: Electron for cross-platform desktop application
- **Styling**: Inline styles with modern CSS3 features
- **File System**: Node.js fs module for file operations
- **IPC Communication**: Secure renderer-main process communication
- **Canvas API**: HTML5 Canvas for drawing and annotation tools

## 📁 Project Structure

```
Data Labeler/
├── src/
│   ├── renderer.jsx          # Main React application
│   └── annotation.jsx        # Annotation interface component
├── main.js                   # Electron main process
├── preload.js               # Secure IPC bridge
├── package.json             # Dependencies and scripts
├── vite.config.js          # Build configuration
└── README.md               # Documentation
```

## 🎯 Workflow

### 1. Project Setup
1. Launch Data Labeler
2. Create a new project or open an existing one
3. Upload images to get started

### 2. Image Organization
1. **Unlabeled Stage**: Upload and review raw images
   - Use "Move All" to bulk transfer to annotation queue
   - Or select specific images to move individually
2. **To Annotate Stage**: Queue images for annotation
   - Click "Label Images" to open annotation interface
   - Move completed images to dataset stage
3. **Dataset Stage**: Collect finished annotations
   - Use "Create Dataset" to generate training sets

### 3. Annotation Process
1. Open annotation interface from "To Annotate" stage
2. Switch between Draw and Select modes:
   - **Draw Mode**: Click and drag to create new bounding boxes
   - **Select Mode**: Click existing boxes to edit or delete
3. Assign class labels to each bounding box
4. Navigate between images using next/previous controls
5. Return to project overview when complete

### 4. Dataset Creation
1. Navigate to "Datasets" tab in sidebar
2. Click "Create Dataset" from the Dataset stage
3. Configure dataset parameters:
   - Dataset name and version
   - Train/Validation/Test split percentages
   - Total image count verification
4. Generate YOLO-formatted dataset with proper folder structure

## 📊 Dataset Output Format

Created datasets follow the standard YOLO format:

```
dataset-name/
├── train/
│   ├── images/
│   └── labels/
├── valid/
│   ├── images/
│   └── labels/
└── test/
    ├── images/
    └── labels/
```

## 🎨 Key UI Components

- **Project Dashboard**: Central hub for project management
- **Three-Column Layout**: Visual representation of annotation pipeline
- **Annotation Canvas**: Interactive drawing surface with tool selection
- **Right Sidebar**: Bounding box management and editing tools
- **Dataset Modal**: Configuration interface for dataset creation
- **Tabbed Navigation**: Clean separation of Overview and Dataset management

## 🔧 Development Features

- **Hot Reload**: Vite-powered development server
- **Error Handling**: Comprehensive error management and user feedback
- **State Management**: React hooks for efficient state handling
- **File Validation**: Automatic checking of supported image formats
- **Progress Tracking**: Visual indicators for annotation completion

## 📈 Benefits

- **Efficiency**: Streamlined workflow reduces annotation time
- **Quality**: Individual box editing ensures precise annotations
- **Organization**: Clear project structure and file management
- **Flexibility**: Customizable dataset splits and versioning
- **Professional**: Industry-standard YOLO format output
- **User-Friendly**: Intuitive interface suitable for all skill levels

## 🎯 Use Cases

- **Computer Vision Projects**: Object detection and classification datasets
- **Machine Learning Training**: Prepare datasets for model training
- **Research**: Academic projects requiring annotated image datasets
- **Commercial Applications**: Product development and prototype testing
- **Educational**: Teaching annotation techniques and dataset preparation

---

*Data Labeler - Professional Image Annotation and Dataset Management*
