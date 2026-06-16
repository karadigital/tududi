#!/usr/bin/env node

/**
 * Data Import Script
 * Imports selected entity types from an export file into a user account.
 * Usage: node import-data.js --user <email|id> --file <path>
 *                            [--types tags,areas,projects,tasks,notes,inbox_items,views]
 *                            [--dry-run]
 *
 * Available types (order matters for dependencies):
 *   tags, areas, projects, tasks, notes, inbox_items, views
 *
 * Examples:
 *   Import everything:
 *     node import-data.js --user admin@example.com --file export.json.gz
 *
 *   Import only projects and tasks (tags auto-included as dependency):
 *     node import-data.js --user admin@example.com --file export.json.gz --types projects,tasks
 *
 *   Preview without writing:
 *     node import-data.js --user admin@example.com --file export.json.gz --dry-run
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;
const zlib = require('zlib');
const { promisify } = require('util');

const gunzip = promisify(zlib.gunzip);

const { User, sequelize } = require('../models');
const {
    importUserData,
    validateBackupData,
    checkVersionCompatibility,
} = require('../services/backupService');

const ALL_TYPES = ['tags', 'areas', 'projects', 'tasks', 'notes', 'inbox_items', 'views'];

// Dependency map: importing X also requires these types to resolve FK relationships
const DEPENDENCIES = {
    projects: ['tags', 'areas'],
    tasks: ['tags', 'projects'],
    notes: ['tags', 'projects'],
    inbox_items: [],
    views: [],
    areas: [],
    tags: [],
};

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--user' && args[i + 1]) opts.user = args[++i];
        else if (args[i] === '--file' && args[i + 1]) opts.file = args[++i];
        else if (args[i] === '--types' && args[i + 1]) opts.types = args[++i].split(',').map((t) => t.trim());
        else if (args[i] === '--dry-run') opts.dryRun = true;
        else if (args[i] === '--no-merge') opts.noMerge = true;
    }
    return opts;
}

function resolveTypes(requested) {
    const resolved = new Set(requested);
    for (const type of requested) {
        for (const dep of (DEPENDENCIES[type] || [])) {
            resolved.add(dep);
        }
    }
    // Return in dependency order
    return ALL_TYPES.filter((t) => resolved.has(t));
}

async function findUser(identifier) {
    const byId = Number(identifier);
    if (!isNaN(byId)) return User.findByPk(byId);
    return User.findOne({ where: { email: identifier } });
}

async function readBackupFile(filePath) {
    const buf = await fs.readFile(filePath);
    const isGzipped = filePath.endsWith('.gz') || (buf[0] === 0x1f && buf[1] === 0x8b);
    const json = isGzipped ? (await gunzip(buf)).toString('utf8') : buf.toString('utf8');
    return JSON.parse(json);
}

function filterBackupData(backupData, types) {
    const filtered = {
        ...backupData,
        data: {},
    };
    for (const type of ALL_TYPES) {
        filtered.data[type] = types.includes(type) ? (backupData.data[type] || []) : [];
    }
    // task_events not selectable — always exclude to avoid orphaned events
    filtered.data.task_events = [];
    return filtered;
}

async function main() {
    const opts = parseArgs();

    if (!opts.user || !opts.file) {
        console.error('Usage: node import-data.js --user <email|id> --file <path> [--types <list>] [--dry-run]');
        console.error('  --types  Comma-separated: tags,areas,projects,tasks,notes,inbox_items,views');
        console.error('  --dry-run  Show what would be imported without writing');
        process.exit(1);
    }

    const user = await findUser(opts.user);
    if (!user) {
        console.error(`User not found: ${opts.user}`);
        process.exit(1);
    }

    const filePath = path.resolve(opts.file);
    let backupData;
    try {
        backupData = await readBackupFile(filePath);
    } catch (err) {
        console.error(`Cannot read file: ${err.message}`);
        process.exit(1);
    }

    const validation = validateBackupData(backupData);
    if (!validation.valid) {
        console.error('Invalid backup file:', validation.errors.join(', '));
        process.exit(1);
    }

    const versionCheck = checkVersionCompatibility(backupData.version);
    if (!versionCheck.compatible) {
        console.error(versionCheck.message);
        process.exit(1);
    }

    const requestedTypes = opts.types || ALL_TYPES;
    const invalid = requestedTypes.filter((t) => !ALL_TYPES.includes(t));
    if (invalid.length) {
        console.error(`Unknown types: ${invalid.join(', ')}`);
        console.error(`Valid types: ${ALL_TYPES.join(', ')}`);
        process.exit(1);
    }

    const types = resolveTypes(requestedTypes);
    const autoadded = types.filter((t) => !requestedTypes.includes(t));

    console.log(`Importing into user: ${user.email} (id=${user.id})`);
    console.log(`Source file: ${filePath} (version ${backupData.version}, exported ${backupData.exported_at})`);
    console.log(`\nEntity types to import: ${types.join(', ')}`);
    if (autoadded.length) {
        console.log(`  (auto-included as dependencies: ${autoadded.join(', ')})`);
    }

    const filtered = filterBackupData(backupData, types);

    console.log('\nItems in file for selected types:');
    for (const type of types) {
        console.log(`  ${type.padEnd(12)}: ${(filtered.data[type] || []).length}`);
    }

    if (opts.dryRun) {
        console.log('\n[dry-run] No changes written.');
        await sequelize.close();
        return;
    }

    console.log('\nImporting...');
    const stats = await importUserData(user.id, filtered, { merge: !opts.noMerge });

    console.log('\nResults:');
    for (const [type, counts] of Object.entries(stats)) {
        console.log(`  ${type.padEnd(12)}: ${counts.created} created, ${counts.skipped} skipped`);
    }

    await sequelize.close();
}

main().catch((err) => {
    console.error('Import failed:', err.message);
    process.exit(1);
});