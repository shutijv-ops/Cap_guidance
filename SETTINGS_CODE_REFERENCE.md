# Settings Implementation - Code Reference

## Complete JavaScript Functions

### 1. Load Settings
```javascript
function loadSettings() {
  try {
    const saved = localStorage.getItem('dashboardSettings');
    return saved ? JSON.parse(saved) : { ...defaultSettings };
  } catch (e) {
    console.error('[SETTINGS] Error loading settings:', e);
    return { ...defaultSettings };
  }
}
```

### 2. Save Settings
```javascript
function saveSettings(settings) {
  try {
    localStorage.setItem('dashboardSettings', JSON.stringify(settings));
    console.log('[SETTINGS] Settings saved:', settings);
    return true;
  } catch (e) {
    console.error('[SETTINGS] Error saving settings:', e);
    return false;
  }
}
```

### 3. Setup Settings View
```javascript
function setupSettingsView() {
  const settings = loadSettings();
  
  // Load current values into form
  const sessionThresholdInput = document.getElementById('sessionThreshold');
  const warningThresholdInput = document.getElementById('warningThreshold');
  const criticalThresholdInput = document.getElementById('criticalThreshold');
  
  if (sessionThresholdInput) {
    sessionThresholdInput.value = settings.sessionThreshold || defaultSettings.sessionThreshold;
  }
  if (warningThresholdInput) {
    warningThresholdInput.value = settings.warningThreshold || defaultSettings.warningThreshold;
  }
  if (criticalThresholdInput) {
    criticalThresholdInput.value = settings.criticalThreshold || defaultSettings.criticalThreshold;
  }
  
  // Set up save button
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveSettingsHandler);
  }
  
  // Set up reset button
  const resetSettingsBtn = document.getElementById('resetSettingsBtn');
  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', resetSettingsHandler);
  }
  
  // Show status message if exists
  updateSettingsDisplay();
}
```

### 4. Save Settings Handler (With Validation)
```javascript
function saveSettingsHandler() {
  const sessionThreshold = parseInt(document.getElementById('sessionThreshold').value) || defaultSettings.sessionThreshold;
  const warningThreshold = parseInt(document.getElementById('warningThreshold').value) || defaultSettings.warningThreshold;
  const criticalThreshold = parseInt(document.getElementById('criticalThreshold').value) || defaultSettings.criticalThreshold;
  
  // Validation
  if (sessionThreshold < 1) {
    alert('Session threshold must be at least 1');
    return;
  }
  if (warningThreshold < sessionThreshold) {
    alert('Warning threshold must be greater than session threshold');
    return;
  }
  if (criticalThreshold < warningThreshold) {
    alert('Critical threshold must be greater than warning threshold');
    return;
  }
  
  const newSettings = {
    sessionThreshold,
    warningThreshold,
    criticalThreshold
  };
  
  if (saveSettings(newSettings)) {
    showSettingsMessage('Settings saved successfully!', 'success');
  } else {
    showSettingsMessage('Failed to save settings', 'error');
  }
}
```

### 5. Reset Settings Handler
```javascript
function resetSettingsHandler() {
  if (confirm('Reset all settings to defaults?')) {
    if (saveSettings({ ...defaultSettings })) {
      document.getElementById('sessionThreshold').value = defaultSettings.sessionThreshold;
      document.getElementById('warningThreshold').value = defaultSettings.warningThreshold;
      document.getElementById('criticalThreshold').value = defaultSettings.criticalThreshold;
      showSettingsMessage('Settings reset to defaults', 'success');
    }
  }
}
```

### 6. Show Settings Message
```javascript
function showSettingsMessage(message, type = 'info') {
  const messageEl = document.getElementById('settingsMessage');
  if (messageEl) {
    messageEl.textContent = message;
    messageEl.className = 'settings-message ' + type;
    messageEl.style.display = 'block';
    
    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 3000);
  }
}
```

### 7. Update Settings Display
```javascript
function updateSettingsDisplay() {
  const settings = loadSettings();
  const displayEl = document.getElementById('settingsDisplay');
  if (displayEl) {
    displayEl.innerHTML = '<p>Session Threshold: ' + settings.sessionThreshold + ' sessions</p>' +
                          '<p>Warning Threshold: ' + settings.warningThreshold + ' sessions</p>' +
                          '<p>Critical Threshold: ' + settings.criticalThreshold + ' sessions</p>';
  }
}
```

## Default Settings Object

```javascript
const defaultSettings = {
  sessionThreshold: 5,      // Initial threshold
  warningThreshold: 10,     // Warning level
  criticalThreshold: 15     // Critical level
};
```

## CSS Classes & Styles

### Settings Container
```css
.settings-container {
  background: var(--card, #fff);
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  max-width: 600px;
  margin: 0 auto;
}
```

### Settings Group
```css
.settings-group {
  margin-bottom: 2rem;
}

.settings-group h3 {
  color: #1f2937;
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 0.5rem;
}
```

### Settings Field
```css
.settings-field {
  margin-bottom: 1.5rem;
}

.settings-field label {
  display: block;
  color: #374151;
  font-weight: 500;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.settings-field input[type="number"] {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.settings-field input[type="number"]:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.settings-field .help-text {
  color: #6b7280;
  font-size: 0.85rem;
  margin-top: 0.25rem;
}
```

### Action Buttons
```css
.btn-save, .btn-reset {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-save {
  background-color: #10b981;
  color: white;
}

.btn-save:hover {
  background-color: #059669;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-reset {
  background-color: #6b7280;
  color: white;
}

.btn-reset:hover {
  background-color: #4b5563;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(107, 114, 128, 0.3);
}
```

### Message Styles
```css
.settings-message {
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  display: none;
  font-weight: 500;
}

.settings-message.success {
  background-color: #d1fae5;
  color: #065f46;
  border-left: 4px solid #10b981;
}

.settings-message.error {
  background-color: #fee2e2;
  color: #991b1b;
  border-left: 4px solid #ef4444;
}

.settings-message.info {
  background-color: #dbeafe;
  color: #0c2d6b;
  border-left: 4px solid #3b82f6;
}
```

## HTML Structure

### Settings Form
```html
<div class="settings-group">
  <h3>🎯 Session Thresholds</h3>
  <p style="color:#6b7280; margin-bottom:1.5rem;">
    Configure alert thresholds for student appointments.
  </p>

  <!-- Session Threshold -->
  <div class="settings-field">
    <label for="sessionThreshold">Session Count Threshold</label>
    <input type="number" id="sessionThreshold" min="1" max="50" value="5" />
    <div class="help-text">Number of sessions before generating alerts (default: 5)</div>
  </div>

  <!-- Warning Threshold -->
  <div class="settings-field">
    <label for="warningThreshold">Warning Level Threshold</label>
    <input type="number" id="warningThreshold" min="1" max="100" value="10" />
    <div class="help-text">Number of sessions for warning-level alerts (default: 10)</div>
  </div>

  <!-- Critical Threshold -->
  <div class="settings-field">
    <label for="criticalThreshold">Critical Level Threshold</label>
    <input type="number" id="criticalThreshold" min="1" max="100" value="15" />
    <div class="help-text">Number of sessions for critical-level alerts (default: 15)</div>
  </div>
</div>

<!-- Action Buttons -->
<div class="settings-buttons">
  <button id="saveSettingsBtn" class="btn-save">💾 Save Settings</button>
  <button id="resetSettingsBtn" class="btn-reset">🔄 Reset to Defaults</button>
</div>
```

## Usage Examples

### Example 1: Load Settings in Another View
```javascript
const settings = loadSettings();
console.log('Current thresholds:', settings);
// Output: { sessionThreshold: 5, warningThreshold: 10, criticalThreshold: 15 }
```

### Example 2: Check Threshold in Student Dashboard
```javascript
function updateStudentStatus(student) {
  const settings = loadSettings();
  const appointmentCount = student.appointments.length;
  
  if (appointmentCount > settings.criticalThreshold) {
    student.alertLevel = 'critical';
    student.alertColor = '#ef4444';
  } else if (appointmentCount > settings.warningThreshold) {
    student.alertLevel = 'warning';
    student.alertColor = '#f59e0b';
  } else if (appointmentCount > settings.sessionThreshold) {
    student.alertLevel = 'caution';
    student.alertColor = '#eab308';
  }
}
```

### Example 3: Filter Students by Threshold
```javascript
function getCriticalStudents() {
  const settings = loadSettings();
  return students.filter(s => s.appointmentCount > settings.criticalThreshold);
}

function getWarningStudents() {
  const settings = loadSettings();
  return students.filter(s => s.appointmentCount > settings.warningThreshold);
}
```

### Example 4: Update Settings from API
```javascript
async function syncSettingsFromServer() {
  try {
    const response = await fetch('/api/admin/settings');
    const serverSettings = await response.json();
    saveSettings(serverSettings);
    console.log('Settings synced from server');
  } catch (error) {
    console.error('Failed to sync settings:', error);
  }
}
```

## Validation Examples

### Invalid: Session too low
```javascript
saveSettingsHandler();
// Session: 0 → Error: "Session threshold must be at least 1"
```

### Invalid: Warning not greater than session
```javascript
// Session: 5, Warning: 3 → Error: "Warning threshold must be greater than session threshold"
```

### Invalid: Critical not greater than warning
```javascript
// Warning: 10, Critical: 8 → Error: "Critical threshold must be greater than warning threshold"
```

### Valid: All constraints met
```javascript
// Session: 5, Warning: 10, Critical: 15 → Success!
```

---

## Testing Template

```javascript
// Test load defaults
const defaultLoaded = loadSettings();
console.assert(defaultLoaded.sessionThreshold === 5, 'Default session threshold should be 5');

// Test save
saveSettings({ sessionThreshold: 8, warningThreshold: 12, criticalThreshold: 18 });
const savedSettings = loadSettings();
console.assert(savedSettings.sessionThreshold === 8, 'Session should be 8 after save');

// Test reset
saveSettings({ ...defaultSettings });
const reset = loadSettings();
console.assert(reset.sessionThreshold === 5, 'Should reset to default');
```

---

This reference guide provides all the code needed to understand and extend the settings functionality.
