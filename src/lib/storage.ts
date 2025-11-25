import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const RECORDINGS_FILE = path.join(DATA_DIR, 'recordings.json');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');
const RECORDINGS_DIR = path.join(DATA_DIR, 'recordings');
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR);
if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR);

// Initialize files if they don't exist
if (!fs.existsSync(CLIENTS_FILE)) fs.writeFileSync(CLIENTS_FILE, '[]');
if (!fs.existsSync(RECORDINGS_FILE)) fs.writeFileSync(RECORDINGS_FILE, '[]');
if (!fs.existsSync(DOCUMENTS_FILE)) fs.writeFileSync(DOCUMENTS_FILE, '[]');

export async function getClients() {
    const data = fs.readFileSync(CLIENTS_FILE, 'utf-8');
    return JSON.parse(data);
}

export async function saveClients(clients: any[]) {
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2));
}

export async function getRecordings() {
    const data = fs.readFileSync(RECORDINGS_FILE, 'utf-8');
    return JSON.parse(data);
}

export async function saveRecordings(recordings: any[]) {
    fs.writeFileSync(RECORDINGS_FILE, JSON.stringify(recordings, null, 2));
}

export async function saveAudioFile(fileName: string, buffer: Buffer) {
    const filePath = path.join(RECORDINGS_DIR, fileName);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

export async function saveDocumentFile(fileName: string, buffer: Buffer) {
    const filePath = path.join(DOCUMENTS_DIR, fileName);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

export async function getDocuments() {
    const data = fs.readFileSync(DOCUMENTS_FILE, 'utf-8');
    return JSON.parse(data);
}

export async function saveDocuments(documents: any[]) {
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(documents, null, 2));
}
