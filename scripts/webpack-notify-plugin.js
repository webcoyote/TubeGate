/*
 * Webpack plugin to notify on build success/failure
 */

const { exec } = require('child_process');
const path = require('path');

class BuildNotifyPlugin {
  constructor(options = {}) {
    this.speakScript = options.speakScript || path.join(__dirname, 'speak');
    this.enabled = options.enabled !== false;

    // Read project name from package.json
    try {
      const packageJson = require(path.join(__dirname, '..', 'package.json'));
      this.projectName = packageJson.name || 'Project';
    } catch {
      this.projectName = 'Project';
    }
  }

  apply(compiler) {
    if (!this.enabled) return;

    compiler.hooks.done.tap('BuildNotifyPlugin', (stats) => {
      const hasErrors = stats.hasErrors();
      const message = hasErrors
        ? `${this.projectName} build failed!`
        : `${this.projectName} build succeeded!`;

      this.notify(message, !hasErrors);
    });
  }

  notify(message, _isSuccess) {
    exec(`"${this.speakScript}" "${message}"`, (error) => {
      if (error) {
        // Fallback to console speak
        process.stdout.write('\x07');
      }
    });
  }
}

module.exports = BuildNotifyPlugin;
