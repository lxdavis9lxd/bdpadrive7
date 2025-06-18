const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const apiService = require('../services/apiService');

// Helper function to generate a valid client ID (max 25 chars)
function getClientId(req) {
    if (req.sessionID && req.sessionID.length <= 25) {
        return req.sessionID;
    }
    return req.sessionID ? req.sessionID.substring(0, 20) : `web-${Date.now().toString().slice(-10)}`;
}

// Create new file or edit existing file
router.get(['/', '/new', '/:nodeId'], isAuthenticated, async (req, res) => {
    try {
        const { nodeId } = req.params;
        const { parentId } = req.query;
        let file = null;

        if (nodeId) {
            // Get existing file
            const result = await apiService.getNodes(req.session.user.username, [nodeId]);
            file = result.nodes[0];

            if (!file || file.type !== 'file') {
                req.flash('error', 'File not found');
                return res.redirect('/explorer');
            }

            // Check if file is locked by another user
            if (file.lock && 
                file.lock.user !== req.session.user.username && 
                Date.now() - file.lock.createdAt < 30 * 60 * 1000) { // 30 minutes lock
                req.flash('error', 'File is locked by another user');
                return res.redirect('/explorer');
            }

            // Acquire lock
            await apiService.updateNode(req.session.user.username, nodeId, {
                lock: {
                    user: req.session.user.username,
                    client: req.sessionID,
                    createdAt: Date.now()
                }
            });
        }

        res.render('editor/index', {
            file,
            parentId,
            clientId: req.sessionID
        });
    } catch (error) {
        console.error('Editor route error:', error);
        req.flash('error', 'Failed to load editor');
        res.redirect('/explorer');
    }
});

// Save file
router.post('/save', isAuthenticated, async (req, res) => {
    try {
        const { nodeId, name, text, tags, parentId } = req.body;
        const username = req.session.user.username;

        // Validate lock if editing existing file
        if (nodeId) {
            const result = await apiService.getNodes(username, [nodeId]);
            const file = result.nodes[0];
            
            if (!file) {
                return res.status(404).json({ error: 'File not found' });
            }

            const clientId = getClientId(req);
            if (file.lock && 
                (file.lock.user !== username || file.lock.client !== clientId)) {
                return res.status(403).json({ error: 'File is locked by another user' });
            }
        }

        // Validate file size (10KiB limit)
        const textSize = Buffer.from(text).length;
        if (textSize > 10 * 1024) {
            return res.status(400).json({ error: 'File size exceeds 10KiB limit' });
        }

        if (nodeId) {
            // Update existing file
            await apiService.updateNode(username, nodeId, {
                name,
                text,
                tags: tags || []
            });
        } else {
            // Create new file
            // Generate a short client ID (max 25 chars)
            const clientId = getClientId(req);
            
            const newFile = await apiService.createNode(username, {
                type: 'file',
                name,
                text,
                tags: tags || [],
                lock: {
                    user: username,
                    client: clientId,
                    createdAt: Date.now()
                }
            });

            // If parentId is provided, add file to parent folder
            if (parentId) {
                const parentResult = await apiService.getNodes(username, [parentId]);
                const parent = parentResult.nodes[0];
                
                await apiService.updateNode(username, parentId, {
                    contents: [...parent.contents, newFile.node.node_id]
                });
            }

            return res.json({ 
                success: true, 
                nodeId: newFile.node.node_id 
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ error: 'Failed to save file' });
    }
});

// Release lock
router.post('/:nodeId/release-lock', isAuthenticated, async (req, res) => {
    try {
        const { nodeId } = req.params;
        const username = req.session.user.username;

        // Only release if we own the lock
        const result = await apiService.getNodes(username, [nodeId]);
        const file = result.nodes[0];
        
        const clientId = getClientId(req);
        if (file.lock && 
            file.lock.user === username && 
            file.lock.client === clientId) {
            await apiService.updateNode(username, nodeId, {
                lock: null
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Release lock error:', error);
        res.status(500).json({ error: 'Failed to release lock' });
    }
});

module.exports = router;
