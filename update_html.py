#!/usr/bin/env python3
import re

# Read the file
with open('public/HTML/admin_dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Split into lines
lines = content.split('\n')

# Lines to replace (524-605, but 0-indexed so 523-604)
start_line = 517  # Line 518 (0-indexed)
end_line = 605    # Line 605 (0-indexed, inclusive)

# New content
new_content = '''                <!-- LEFT COLUMN -->
                <div>
                  
                  <!-- Password Change Card -->
                  <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <h3 style="color: #0a2342; margin-top: 0; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; font-size: 1.1rem;">🔐 Change Password</h3>
                    <p style="color: #6b7280; margin-bottom: 1.5rem; font-size: 0.95rem;">Update your admin password to keep your account secure.</p>
                    
                    <div class="settings-field">
                      <label for="adminCurrentPassword">Current Password</label>
                      <input type="password" id="adminCurrentPassword" placeholder="Enter your current password" />
                    </div>
                    
                    <div class="settings-field">
                      <label for="adminNewPassword">New Password</label>
                      <input type="password" id="adminNewPassword" placeholder="Enter new password (min 6 characters)" />
                    </div>
                    
                    <div class="settings-field">
                      <label for="adminConfirmPassword">Confirm New Password</label>
                      <input type="password" id="adminConfirmPassword" placeholder="Confirm new password" />
                    </div>
                    
                    <div id="adminPasswordMessage" style="margin-bottom: 1rem; padding: 0.75rem; border-radius: 8px; text-align: center; display: none;"></div>
                    
                    <button id="changeAdminPasswordBtn" class="btn-save" style="width: 100%; margin-top: 0.5rem;">🔐 Change Password</button>
                  </div>
                  
                  <!-- Logout Button Style Toggle Card -->
                  <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <h3 style="color: #0a2342; margin-top: 0; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; font-size: 1.1rem;">🚪 Logout Button Style</h3>
                    <p style="color: #6b7280; margin-bottom: 1.5rem; font-size: 0.95rem;">Customize the appearance of your logout button.</p>
                    
                    <div class="settings-field">
                      <label>Current Style</label>
                      <div style="display: flex; gap: 0.75rem; margin-top: 0.75rem; flex-direction: column;">
                        <button id="logoutStyleBtn" class="btn-save" style="padding: 0.75rem 1.5rem; font-size: 0.95rem;">🔄 Toggle Logout Style</button>
                        <span id="logoutStyleDisplay" style="padding: 0.75rem; background: #f0f9ff; border-radius: 8px; color: #0a2342; font-weight: 600; text-align: center;">Minimal</span>
                      </div>
                      <div class="help-text" style="margin-top: 0.75rem; font-size: 0.85rem; color: #6b7280;">Minimal (→) • Danger (⚠️) • Standard (🚪)</div>
                    </div>
                  </div>
                  
                </div>
                
                <!-- RIGHT COLUMN -->
                <div>
                  
                  <!-- Alert Thresholds Card -->
                  <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <h3 style="color: #0a2342; margin-top: 0; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; font-size: 1.1rem;">⚙️ Alert Thresholds</h3>
                    <p style="color: #6b7280; margin-bottom: 1.5rem; font-size: 0.95rem;">Configure when system alerts are triggered.</p>
                    
                    <div class="settings-field">
                      <label for="sessionThreshold">Session Threshold</label>
                      <input type="number" id="sessionThreshold" placeholder="Session threshold" />
                    </div>
                    
                    <div class="settings-field">
                      <label for="warningThreshold">Warning Threshold</label>
                      <input type="number" id="warningThreshold" placeholder="Warning threshold" />
                    </div>
                    
                    <div class="settings-field">
                      <label for="criticalThreshold">Critical Threshold</label>
                      <input type="number" id="criticalThreshold" placeholder="Critical threshold" />
                    </div>
                    
                    <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
                      <button id="saveSettingsBtn" class="btn-save" style="flex: 1;">💾 Save</button>
                      <button id="resetSettingsBtn" class="btn-reset" style="flex: 1;">🔄 Reset</button>
                    </div>
                  </div>
                  
                  <!-- Daily Limit Card -->
                  <div style="background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 12px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <h3 style="color: #0a2342; margin-top: 0; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; font-size: 1.1rem;">📋 Daily Limit</h3>
                    <p style="color: #0a2342; margin-bottom: 1.5rem; font-size: 0.95rem;">Set maximum appointment requests per student per day.</p>
                    
                    <label style="display: block; font-weight: 600; color: #0a2342; margin-bottom: 0.75rem;">Requests per Day</label>
                    <div style="display: flex; gap: 0.75rem;">
                      <input type="number" id="thresholdInput" min="1" max="20" value="3" style="flex: 1; padding: 0.75rem; border: 2px solid #0ea5e9; border-radius: 8px; font-size: 1rem; font-weight: 600; background: #fff;" />
                      <button id="saveThresholdBtn" class="btn" style="background: #0ea5e9; color: #fff; padding: 0.75rem 1.5rem; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: all 0.24s ease;">Save</button>
                    </div>
                    <p style="color: #0a2342; font-size: 0.85rem; margin-top: 0.75rem; margin-bottom: 0;">Range: 1-20 requests per day</p>
                    
                    <div id="thresholdStatusMessage" style="margin-top: 1rem; padding: 0.75rem; border-radius: 8px; text-align: center; font-weight: 600; display: none;"></div>
                  </div>
                  
                </div>'''

# Replace lines 518-605 with new content
new_lines = lines[:start_line] + new_content.split('\n') + lines[end_line+1:]

# Write back
with open('public/HTML/admin_dashboard.html', 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print("File updated successfully!")
