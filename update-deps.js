const fs = require('fs');
const { execSync } = require('child_process');

// Read the package.json file
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

// Get all dependencies and devDependencies
const dependencies = Object.keys(packageJson.dependencies || {});
const devDependencies = Object.keys(packageJson.devDependencies || {});

console.log('Updating dependencies to latest versions...');

// Update regular dependencies
if (dependencies.length > 0) {
  console.log('\nUpdating dependencies:');
  dependencies.forEach(dep => {
    try {
      console.log(`Updating ${dep}...`);
      const latestVersion = execSync(`npm show ${dep} version`, { encoding: 'utf8' }).trim();
      packageJson.dependencies[dep] = `^${latestVersion}`;
      console.log(`${dep} updated to ${latestVersion}`);
    } catch (error) {
      console.error(`Error updating ${dep}: ${error.message}`);
    }
  });
}

// Update dev dependencies
if (devDependencies.length > 0) {
  console.log('\nUpdating devDependencies:');
  devDependencies.forEach(dep => {
    try {
      console.log(`Updating ${dep}...`);
      const latestVersion = execSync(`npm show ${dep} version`, { encoding: 'utf8' }).trim();
      packageJson.devDependencies[dep] = `^${latestVersion}`;
      console.log(`${dep} updated to ${latestVersion}`);
    } catch (error) {
      console.error(`Error updating ${dep}: ${error.message}`);
    }
  });
}

// Write the updated package.json
fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2));

console.log('\nAll dependencies updated in package.json');
console.log('Run "npm install" to install the updated packages');
