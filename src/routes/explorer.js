const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const apiService = require('../services/apiService');

// List files and folders
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const { sort = 'name', after = null } = req.query;
        const username = req.session.user.username;

        // Get all files for the user using a basic search
        const searchParams = {};
        
        if (after) {
            searchParams.after = after;
        }

        const result = await apiService.searchFiles(username, searchParams);
        let nodes = result.nodes || [];

        // Filter to only show root-level nodes (those without a parent or with parent as null/undefined)
        nodes = nodes.filter(node => !node.parent || node.parent === null);

        // Sort the nodes
        nodes.sort((a, b) => {
            switch (sort) {
                case 'createdAt':
                    return b.createdAt - a.createdAt;
                case 'modifiedAt':
                    return b.modifiedAt - a.modifiedAt;
                case 'size':
                    return (b.size || 0) - (a.size || 0);
                case 'name':
                default:
                    return a.name.localeCompare(b.name);
            }
        });

        res.render('explorer/index', {
            nodes: nodes,
            sort,
            currentFolder: null, // No current folder for root view
            currentPath: []
        });
    } catch (error) {
        console.error('Explorer error:', error);
        req.flash('error', 'Failed to load files');
        res.redirect('/');
    }
});

// View folder contents
router.get('/folder/:nodeId', isAuthenticated, async (req, res) => {
    try {
        const { nodeId } = req.params;
        const { sort = 'name' } = req.query;

        // Get the folder node
        const folderResult = await apiService.getNodes(req.session.user.username, [nodeId]);
        const folder = folderResult.nodes[0];

        if (!folder || folder.type !== 'directory') {
            req.flash('error', 'Folder not found');
            return res.redirect('/explorer');
        }

        // If folder has contents, get their details
        let contents = [];
        if (folder.contents && folder.contents.length > 0) {
            const contentsResult = await apiService.getNodes(req.session.user.username, folder.contents);
            contents = contentsResult.nodes || [];

            // Sort contents
            contents.sort((a, b) => {
                switch (sort) {
                    case 'createdAt':
                        return b.createdAt - a.createdAt;
                    case 'modifiedAt':
                        return b.modifiedAt - a.modifiedAt;
                    case 'size':
                        return (b.size || 0) - (a.size || 0);
                    case 'name':
                    default:
                        return a.name.localeCompare(b.name);
                }
            });
        }

        // Build breadcrumb path
        const pathNodes = await buildPath(req.session.user.username, nodeId);

        res.render('explorer/index', {
            nodes: contents,
            sort,
            currentFolder: folder,
            currentPath: pathNodes
        });
    } catch (error) {
        req.flash('error', 'Failed to load folder contents');
        res.redirect('/explorer');
    }
});

// Create new folder
router.post('/folder', isAuthenticated, async (req, res) => {
    try {
        const { name, parentId } = req.body;

        const newFolder = await apiService.createNode(req.session.user.username, {
            type: 'directory',
            name: name,
            contents: []
        });

        if (parentId) {
            // Get parent folder's current contents
            const parentResult = await apiService.getNodes(req.session.user.username, [parentId]);
            const parent = parentResult.nodes[0];

            // Update parent folder's contents
            await apiService.updateNode(req.session.user.username, parentId, {
                contents: [...parent.contents, newFolder.node.node_id]
            });

            res.redirect(`/explorer/folder/${parentId}`);
        } else {
            res.redirect('/explorer');
        }
    } catch (error) {
        req.flash('error', 'Failed to create folder');
        res.redirect(req.headers.referer || '/explorer');
    }
});

// Create new symlink
router.post('/symlink', isAuthenticated, async (req, res) => {
    try {
        const { name, targetId, parentId } = req.body;

        const newSymlink = await apiService.createNode(req.session.user.username, {
            type: 'symlink',
            name: name,
            contents: [targetId]
        });

        if (parentId) {
            // Get parent folder's current contents
            const parentResult = await apiService.getNodes(req.session.user.username, [parentId]);
            const parent = parentResult.nodes[0];

            // Update parent folder's contents
            await apiService.updateNode(req.session.user.username, parentId, {
                contents: [...parent.contents, newSymlink.node.node_id]
            });

            res.redirect(`/explorer/folder/${parentId}`);
        } else {
            res.redirect('/explorer');
        }
    } catch (error) {
        req.flash('error', 'Failed to create symlink');
        res.redirect(req.headers.referer || '/explorer');
    }
});

// Update node (rename, move, change tags)
router.put('/node/:nodeId', isAuthenticated, async (req, res) => {
    try {
        const { nodeId } = req.params;
        const { name, tags, newParentId, currentParentId } = req.body;

        // Update node name and/or tags
        const updateData = {};
        if (name) updateData.name = name;
        if (tags) updateData.tags = tags;

        await apiService.updateNode(req.session.user.username, nodeId, updateData);

        // Handle moving the node to a new parent folder
        if (newParentId && newParentId !== currentParentId) {
            // Remove from current parent
            if (currentParentId) {
                const currentParentResult = await apiService.getNodes(req.session.user.username, [currentParentId]);
                const currentParent = currentParentResult.nodes[0];
                await apiService.updateNode(req.session.user.username, currentParentId, {
                    contents: currentParent.contents.filter(id => id !== nodeId)
                });
            }

            // Add to new parent
            const newParentResult = await apiService.getNodes(req.session.user.username, [newParentId]);
            const newParent = newParentResult.nodes[0];
            await apiService.updateNode(req.session.user.username, newParentId, {
                contents: [...newParent.contents, nodeId]
            });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update node' });
    }
});

// Delete node
router.delete('/node/:nodeId', isAuthenticated, async (req, res) => {
    try {
        const { nodeId } = req.params;
        const { parentId } = req.body;

        // If node is in a folder, remove it from folder's contents first
        if (parentId) {
            const parentResult = await apiService.getNodes(req.session.user.username, [parentId]);
            const parent = parentResult.nodes[0];
            await apiService.updateNode(req.session.user.username, parentId, {
                contents: parent.contents.filter(id => id !== nodeId)
            });
        }

        // Delete the node
        await apiService.deleteNodes(req.session.user.username, [nodeId]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete node' });
    }
});

// Helper function to build path to a node
async function buildPath(username, nodeId) {
    const path = [];
    let currentNodeId = nodeId;

    while (currentNodeId) {
        try {
            const result = await apiService.getNodes(username, [currentNodeId]);
            const node = result.nodes[0];
            if (!node) break;

            path.unshift(node);

            // Find parent by searching for a directory that contains this node
            const parentSearch = await apiService.searchFiles(username, {
                match: {
                    type: 'directory',
                    contents: currentNodeId
                }
            });

            if (!parentSearch.nodes || parentSearch.nodes.length === 0) break;
            currentNodeId = parentSearch.nodes[0].node_id;
        } catch (error) {
            break;
        }
    }

    return path;
}

module.exports = router;
