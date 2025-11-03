#!/usr/bin/env node

/**
 * OpenCode-Amplifier MCP Bridge
 * 
 * A minimal MCP server that exposes Amplifier scenarios to OpenCode.ai
 * Designed for simplicity and easy maintenance as both projects evolve.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import { readdir, readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  amplifierPath: process.env.AMPLIFIER_PATH || join(__dirname, '../amplifier'),
  pythonPath: process.env.PYTHON_PATH || 'python3',
  timeout: parseInt(process.env.TIMEOUT || '300000', 10),
  logLevel: process.env.LOG_LEVEL || 'INFO',
};

// ============================================================================
// LOGGING
// ============================================================================

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const currentLogLevel = LOG_LEVELS[CONFIG.logLevel] || LOG_LEVELS.INFO;

function log(level, message, data) {
  if (LOG_LEVELS[level] >= currentLogLevel) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    console.error(`[${timestamp}] ${level}: ${message}${dataStr}`);
  }
}

// ============================================================================
// SCENARIO DISCOVERY
// ============================================================================

async function discoverScenarios() {
  const scenariosPath = join(CONFIG.amplifierPath, 'scenarios');
  log('INFO', 'Discovering scenarios', { path: scenariosPath });

  try {
    const entries = await readdir(scenariosPath, { withFileTypes: true });
    const scenarios = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const scenarioPath = join(scenariosPath, entry.name);
      
      // Check if scenario has main.py or __main__.py
      const hasMain = await checkFile(join(scenarioPath, 'main.py'));
      const hasMainModule = await checkFile(join(scenarioPath, '__main__.py'));
      
      if (!hasMain && !hasMainModule) continue;

      // Extract metadata
      const description = await extractDescription(scenarioPath);
      const parameters = await extractParameters(scenarioPath, hasMain ? 'main.py' : '__main__.py');

      scenarios.push({
        name: entry.name,
        description,
        parameters,
      });

      log('DEBUG', 'Discovered scenario', { name: entry.name, params: parameters.length });
    }

    log('INFO', 'Discovery complete', { count: scenarios.length });
    return scenarios;
  } catch (error) {
    log('ERROR', 'Discovery failed', { error: error.message });
    throw error;
  }
}

async function checkFile(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function extractDescription(scenarioPath) {
  try {
    const readme = await readFile(join(scenarioPath, 'README.md'), 'utf-8');
    const lines = readme.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      return trimmed.replace(/\*\*/g, '');
    }
  } catch {
    // Fallback to scenario name
  }
  
  return `Amplifier scenario: ${scenarioPath.split('/').pop()}`;
}

async function extractParameters(scenarioPath, filename) {
  try {
    const content = await readFile(join(scenarioPath, filename), 'utf-8');
    const params = [];
    
    // Match Click decorators: @click.option("--param-name", ...)
    const regex = /@click\.(option|argument)\(\s*["']--([^"']+)["'][^)]*help\s*=\s*["']([^"']+)["']/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const [, type, name, help] = match;
      params.push({
        name,
        type: 'string',
        description: help,
        required: type === 'argument',
      });
    }
    
    return params;
  } catch (error) {
    log('WARN', 'Parameter extraction failed', { scenario: scenarioPath, error: error.message });
    return [];
  }
}

// ============================================================================
// SCENARIO EXECUTION
// ============================================================================

async function executeScenario(scenarioName, args) {
  log('INFO', 'Executing scenario', { scenario: scenarioName, args });

  const cmdArgs = ['-m', `scenarios.${scenarioName}`];
  
  // Build command line arguments
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    
    if (typeof value === 'boolean') {
      if (value) cmdArgs.push(`--${key}`);
    } else if (Array.isArray(value)) {
      value.forEach(v => cmdArgs.push(`--${key}`, String(v)));
    } else {
      cmdArgs.push(`--${key}`, String(value));
    }
  }

  return new Promise((resolve, reject) => {
    const process = spawn(CONFIG.pythonPath, cmdArgs, {
      cwd: CONFIG.amplifierPath,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      process.kill('SIGTERM');
      setTimeout(() => process.kill('SIGKILL'), 5000);
    }, CONFIG.timeout);

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      clearTimeout(timer);

      if (timedOut) {
        reject(new Error(`Execution timed out after ${CONFIG.timeout}ms`));
        return;
      }

      resolve({ stdout, stderr, exitCode: code || 0 });
    });

    process.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`Execution failed: ${error.message}`));
    });
  });
}

// ============================================================================
// MCP SERVER
// ============================================================================

class AmplifierMCPServer {
  constructor() {
    this.server = new Server(
      { name: 'opencode-amplifier', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );
    this.scenarios = [];
    this.setupHandlers();
  }

  async initialize() {
    log('INFO', 'Initializing server', CONFIG);
    this.scenarios = await discoverScenarios();
  }

  setupHandlers() {
    // List tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.scenarios.map(s => ({
          name: `amplifier_${s.name}`,
          description: s.description,
          inputSchema: {
            type: 'object',
            properties: Object.fromEntries(
              s.parameters.map(p => [
                p.name,
                { type: p.type, description: p.description }
              ])
            ),
            required: s.parameters.filter(p => p.required).map(p => p.name),
          },
        })),
      };
    });

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const scenarioName = toolName.replace(/^amplifier_/, '');
      const args = request.params.arguments || {};

      log('INFO', 'Tool called', { tool: toolName, args });

      try {
        const result = await executeScenario(scenarioName, args);

        if (result.exitCode !== 0) {
          return {
            content: [{
              type: 'text',
              text: `Error (exit ${result.exitCode}):\n${result.stderr || result.stdout}`,
            }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text',
            text: result.stdout || 'Success',
          }],
        };
      } catch (error) {
        log('ERROR', 'Execution failed', { error: error.message });
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`,
          }],
          isError: true,
        };
      }
    });
  }

  async start() {
    await this.initialize();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    log('INFO', 'Server started');

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  async shutdown() {
    log('INFO', 'Shutting down');
    await this.server.close();
    process.exit(0);
  }
}

// ============================================================================
// MAIN
// ============================================================================

const server = new AmplifierMCPServer();
server.start().catch((error) => {
  log('ERROR', 'Server failed', { error: error.message });
  process.exit(1);
});
