const cryptoService = require('../services/cryptoService');
const apiService = require('../services/apiService');

async function createAccount(username, email, password) {
    try {
        // Generate salt and derive key
        const salt = await cryptoService.generateSalt();
        const key = await cryptoService.deriveKey(password, salt);

        // Create user
        const result = await apiService.createUser({
            username,
            email,
            salt,
            key
        });

        if (result.success) {
            console.log(`Successfully created account for ${username}`);
            return result.user;
        } else {
            console.error(`Failed to create account for ${username}`);
            return null;
        }
    } catch (error) {
        console.error(`Error creating account for ${username}:`, error.message);
        return null;
    }
}

async function setupAccounts() {
    try {
        // Create admin account
        const adminUser = await createAccount(
            'admin',
            'admin@bdpadrive.com',
            'Admin@123'
        );

        // Create demo account
        const demoUser = await createAccount(
            'demo',
            'demo@bdpadrive.com',
            'Demo@123'
        );

        if (adminUser) {
            // Create a welcome file for admin
            await apiService.createNode('admin', {
                type: 'file',
                name: 'welcome.md',
                text: '# Welcome to BDPADrive Admin\n\nThis is your administrative account.',
                tags: ['admin', 'welcome']
            });
        }

        if (demoUser) {
            // Create some demo files and folders
            const demoFolder = await apiService.createNode('demo', {
                type: 'directory',
                name: 'Demo Files',
                contents: []
            });

            if (demoFolder.success) {
                // Create a welcome file
                const welcomeFile = await apiService.createNode('demo', {
                    type: 'file',
                    name: 'welcome.md',
                    text: '# Welcome to BDPADrive\n\nThis is a demo account with some sample files.',
                    tags: ['demo', 'welcome'],
                    lock: null
                });

                // Create a sample markdown file
                const sampleFile = await apiService.createNode('demo', {
                    type: 'file',
                    name: 'markdown-sample.md',
                    text: `# Markdown Sample\n\n## Headers\n\n# H1\n## H2\n### H3\n\n## Emphasis\n\n*italic* or _italic_\n**bold** or __bold__\n\n## Lists\n\n1. First item\n2. Second item\n3. Third item\n\n- Unordered item\n- Another item\n  - Sub-item\n  - Another sub-item\n\n## Links\n\n[BDPA](https://bdpa.org)\n\n## Code\n\n\`inline code\`\n\n\`\`\`javascript\nfunction hello() {\n    console.log("Hello, BDPADrive!");\n}\n\`\`\``,
                    tags: ['demo', 'markdown', 'sample'],
                    lock: null
                });

                // Update folder contents
                if (welcomeFile.success && sampleFile.success) {
                    await apiService.updateNode('demo', demoFolder.node.node_id, {
                        contents: [
                            welcomeFile.node.node_id,
                            sampleFile.node.node_id
                        ]
                    });
                }
            }
        }

        console.log('\nAccounts created successfully!');
        console.log('\nAdmin account:');
        console.log('Username: admin');
        console.log('Password: Admin@123');
        console.log('\nDemo account:');
        console.log('Username: demo');
        console.log('Password: Demo@123');

    } catch (error) {
        console.error('Error in setupAccounts:', error);
    }
}

// Run the setup
setupAccounts().catch(console.error);
