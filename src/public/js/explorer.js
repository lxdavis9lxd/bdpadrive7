// Initialize markdown renderer
marked.setOptions({
    breaks: true,
    sanitize: true
});

// Initialize markdown previews
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.markdown-preview').forEach(preview => {
        const text = preview.textContent;
        preview.innerHTML = marked(text);
    });
});

// Modal handling functions
function showCreateFolderModal() {
    const currentFolderId = new URLSearchParams(window.location.search).get('folderId');
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Create New Folder</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <form action="/explorer/folder" method="POST">
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="folderName" class="form-label">Folder Name</label>
                            <input type="text" class="form-control" id="folderName" name="name" required>
                        </div>
                        <input type="hidden" name="parentId" value="${currentFolderId || ''}">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
}

function showCreateSymlinkModal() {
    const currentFolderId = new URLSearchParams(window.location.search).get('folderId');
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Create New Symlink</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <form action="/explorer/symlink" method="POST">
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="symlinkName" class="form-label">Symlink Name</label>
                            <input type="text" class="form-control" id="symlinkName" name="name" required>
                        </div>
                        <div class="mb-3">
                            <label for="targetId" class="form-label">Target Node ID</label>
                            <input type="text" class="form-control" id="targetId" name="targetId" required>
                            <div class="form-text">Enter the node_id of the file or folder this symlink should point to</div>
                        </div>
                        <input type="hidden" name="parentId" value="${currentFolderId || ''}">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
}

function showRenameModal(nodeId, currentName) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Rename</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label for="newName" class="form-label">New Name</label>
                        <input type="text" class="form-control" id="newName" value="${currentName}">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="renameNode('${nodeId}')">Rename</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
}

function showMoveModal(nodeId) {
    // This would typically show a tree view of folders
    // For simplicity, we'll just ask for the target folder ID
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Move Item</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label for="newParentId" class="form-label">Target Folder ID</label>
                        <input type="text" class="form-control" id="newParentId" placeholder="Leave empty to move to root folder">
                        <div class="form-text">
                            Enter the node_id of the destination folder, or leave empty to move to root folder.
                            You can see folder IDs displayed under each folder name.
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="moveNode('${nodeId}')">Move</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
}

// Node operations
async function renameNode(nodeId) {
    const newName = document.getElementById('newName').value;
    try {
        const response = await fetch(`/explorer/node/${nodeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
        });
        
        if (response.ok) {
            window.location.reload();
        } else {
            alert('Failed to rename item');
        }
    } catch (error) {
        alert('Failed to rename item');
    }
}

async function moveNode(nodeId) {
    const newParentId = document.getElementById('newParentId').value;
    
    // Get current parent ID from URL or detect from current page
    let currentParentId = null;
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length > 3 && pathParts[2] === 'folder') {
        currentParentId = pathParts[3];
    }
    
    try {
        const response = await fetch(`/explorer/node/${nodeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                newParentId: newParentId || null, // Allow moving to root
                currentParentId: currentParentId
            })
        });
        
        if (response.ok) {
            window.location.reload();
        } else {
            const error = await response.json();
            alert(`Failed to move item: ${error.error || 'Unknown error'}`);
        }
    } catch (error) {
        alert('Failed to move item: Network error');
    }
}

async function confirmDelete(nodeId) {
    if (confirm('Are you sure you want to delete this item?')) {
        try {
            const currentFolderId = new URLSearchParams(window.location.search).get('folderId');
            const response = await fetch(`/explorer/node/${nodeId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    parentId: currentFolderId
                })
            });
            
            if (response.ok) {
                window.location.reload();
            } else {
                alert('Failed to delete item');
            }
        } catch (error) {
            alert('Failed to delete item');
        }
    }
}
