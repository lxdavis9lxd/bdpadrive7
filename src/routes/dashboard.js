const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const apiService = require('../services/apiService');
const cryptoService = require('../services/cryptoService');

router.get('/', isAuthenticated, async (req, res) => {
    try {
        // Get user's files to calculate storage usage
        const files = await apiService.searchFiles(req.session.user.username);
        let totalSize = 0;

        if (files.nodes) {
            totalSize = files.nodes
                .filter(node => node.type === 'file')
                .reduce((sum, file) => sum + (file.size || 0), 0);
        }

        // Get user data
        const userData = await apiService.getUser(req.session.user.username);

        res.render('dashboard/index', {
            user: userData.user,
            totalSize,
            formattedSize: formatBytes(totalSize)
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        req.flash('error', 'Failed to load dashboard');
        res.redirect('/');
    }
});

// Update user email
router.put('/email', isAuthenticated, async (req, res) => {
    try {
        const { email } = req.body;
        await apiService.updateUser(req.session.user.username, { email });
        req.flash('success', 'Email updated successfully');
        res.redirect('/dashboard');
    } catch (error) {
        req.flash('error', 'Failed to update email');
        res.redirect('/dashboard');
    }
});

// Update user password
router.put('/password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Get current user data to verify password
        const userData = await apiService.getUser(req.session.user.username);
        
        // Generate key from current password
        const currentKey = await cryptoService.deriveKey(currentPassword, userData.user.salt);
        
        // Verify current password
        const authResult = await apiService.authenticateUser(req.session.user.username, currentKey);
        
        if (!authResult.success) {
            req.flash('error', 'Current password is incorrect');
            return res.redirect('/dashboard');
        }

        // Generate new salt and key
        const newSalt = await cryptoService.generateSalt();
        const newKey = await cryptoService.deriveKey(newPassword, newSalt);

        // Update password
        await apiService.updateUser(req.session.user.username, {
            salt: newSalt,
            key: newKey
        });

        req.flash('success', 'Password updated successfully');
        res.redirect('/dashboard');
    } catch (error) {
        req.flash('error', 'Failed to update password');
        res.redirect('/dashboard');
    }
});

// Delete account
router.delete('/', isAuthenticated, async (req, res) => {
    try {
        const username = req.session.user.username;

        // Get all user's files
        const files = await apiService.searchFiles(username);
        
        // Delete all files
        if (files.nodes && files.nodes.length > 0) {
            const nodeIds = files.nodes.map(node => node.node_id);
            await apiService.deleteNodes(username, nodeIds);
        }

        // Delete user account
        await apiService.deleteUser(username);

        // Destroy session
        req.session.destroy();
        
        res.redirect('/');
    } catch (error) {
        req.flash('error', 'Failed to delete account');
        res.redirect('/dashboard');
    }
});

// Helper function to format bytes into human readable format
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router;
