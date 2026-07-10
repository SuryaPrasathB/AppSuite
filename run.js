const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Starting Smart Store Management System...');

// Paths
const backendDir = path.join(__dirname, 'backend');
const frontendDir = path.join(__dirname, 'frontend');

// Determine Python executable (check local virtual env first)
let pythonCmd = 'python';
const venvPythonPath = path.join(backendDir, '.venv', 'Scripts', 'python.exe');
if (fs.existsSync(venvPythonPath)) {
  pythonCmd = venvPythonPath;
  console.log(`Using backend virtual environment python: ${pythonCmd}`);
} else {
  console.log('Virtual environment python not found, falling back to system "python"');
}

// 1. Start Backend
console.log('Launching backend server...');
const backendProcess = spawn(`"${pythonCmd}"`, ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--reload'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: true
});

// 2. Start Frontend
console.log('Launching frontend development server...');
const frontendProcess = spawn('npm', ['run', 'dev'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: true
});

// Handle termination signals to make sure both child processes are cleaned up
let isExiting = false;
const cleanExit = (code) => {
  if (isExiting) return;
  isExiting = true;
  console.log('\nStopping servers...');
  try {
    backendProcess.kill();
  } catch (e) {}
  try {
    frontendProcess.kill();
  } catch (e) {}
  process.exit(code ?? 0);
};

process.on('SIGINT', () => cleanExit(0));
process.on('SIGTERM', () => cleanExit(0));

backendProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.log(`Backend process exited with code ${code}`);
  }
  cleanExit(code);
});

frontendProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.log(`Frontend process exited with code ${code}`);
  }
  cleanExit(code);
});
