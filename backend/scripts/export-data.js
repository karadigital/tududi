#!/usr/bin/env node

/**
 * Data Export Script
 * Exports all data for a user to a portable JSON file.
 * Usage: node export-data.js --user <email|id> [--output <file>]
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);

const { User, sequelize } = require('../models');
const { exportUserData } = require('../services/backupService');

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--user' && args[i + 1]) opts.user = args[++i];
        else if (args[i] === '--output' && args[i + 1]) opts.output = args[++i];
        else if (args[i] === '--no-compress') opts.noCompress = true;
    }
    return opts;
}

async function findUser(identifier) {
    const byId = Number(identifier);
    if (!isNaN(byId)) {
        return User.findByPk(byId);
    }
    return User.findOne({ where: { email: identifier } });
}

async function main() {
    const opts = parseArgs();

    if (!opts.user) {
        console.error('Usage: node export-data.js --user <email|id> [--output <file>] [--no-compress]');
        process.exit(1);
    }

    const user = await findUser(opts.user);
    if (!user) {
        console.error(`User not found: ${opts.user}`);
        process.exit(1);
    }

    console.log(`Exporting data for user: ${user.email} (id=${user.id})`);

    const backupData = await exportUserData(user.id);

    const counts = backupData.data;
    console.log('Items exported:');
    console.log(`  areas:       ${counts.areas.length}`);
    console.log(`  projects:    ${counts.projects.length}`);
    console.log(`  tasks:       ${counts.tasks.length}`);
    console.log(`  tags:        ${counts.tags.length}`);
    console.log(`  notes:       ${counts.notes.length}`);
    console.log(`  inbox_items: ${counts.inbox_items.length}`);
    console.log(`  views:       ${counts.views.length}`);

    const date = new Date().toISOString().split('T')[0];
    const compress = !opts.noCompress;
    const defaultName = `tududi-export-${date}${compress ? '.json.gz' : '.json'}`;
    const outputPath = path.resolve(opts.output || defaultName);

    const json = JSON.stringify(backupData, null, 2);
    if (compress) {
        const compressed = await gzip(json);
        await fs.writeFile(outputPath, compressed);
    } else {
        await fs.writeFile(outputPath, json, 'utf8');
    }

    console.log(`\nExported to: ${outputPath}`);
    await sequelize.close();
}

main().catch((err) => {
    console.error('Export failed:', err.message);
    process.exit(1);
});