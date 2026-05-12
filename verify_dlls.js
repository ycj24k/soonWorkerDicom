const fs = require('fs');
const path = require('path');

const libsDir = path.join(__dirname, 'libs');

function readString(buffer, offset) {
    let end = offset;
    while (buffer[end] !== 0 && end < buffer.length) {
        end++;
    }
    return buffer.toString('utf8', offset, end);
}

function analyzeDll(filePath) {
    const result = {
        file: path.basename(filePath),
        arch: 'Unknown',
        debugDeps: [],
        imports: [],
        error: null
    };

    try {
        const buffer = fs.readFileSync(filePath);

        // 1. Check Architecture (PE Header)
        const peOffset = buffer.readUInt32LE(0x3C);
        const machineType = buffer.readUInt16LE(peOffset + 4);

        if (machineType === 0x8664) result.arch = 'x64';
        else if (machineType === 0x014c) result.arch = 'x86';
        else result.arch = `Hex:${machineType.toString(16)}`;

        // 2. Check Imports
        const optionalHeaderOffset = peOffset + 24;
        const magic = buffer.readUInt16LE(optionalHeaderOffset);
        const is64Bit = magic === 0x20B;
        const dataDirsOffset = optionalHeaderOffset + (is64Bit ? 112 : 96);
        const importTableRva = buffer.readUInt32LE(dataDirsOffset + 8);

        if (importTableRva !== 0) {
            const numberOfSections = buffer.readUInt16LE(peOffset + 6);
            const sizeOfOptionalHeader = buffer.readUInt16LE(peOffset + 20);
            const sectionHeadersOffset = optionalHeaderOffset + sizeOfOptionalHeader;

            let importSectionOffset = 0;

            for (let i = 0; i < numberOfSections; i++) {
                const entryOffset = sectionHeadersOffset + (i * 40);
                const virtualAddress = buffer.readUInt32LE(entryOffset + 12);
                const virtualSize = buffer.readUInt32LE(entryOffset + 8);
                const pointerToRawData = buffer.readUInt32LE(entryOffset + 20);

                if (importTableRva >= virtualAddress && importTableRva < virtualAddress + virtualSize) {
                    importSectionOffset = pointerToRawData + (importTableRva - virtualAddress);
                    break;
                }
            }

            if (importSectionOffset !== 0) {
                let descriptorOffset = importSectionOffset;
                while (true) {
                    const originalFirstThunk = buffer.readUInt32LE(descriptorOffset);
                    const nameRva = buffer.readUInt32LE(descriptorOffset + 12);
                    if (originalFirstThunk === 0 && nameRva === 0) break;

                    // Find name offset
                    let nameOffset = 0;
                    for (let i = 0; i < numberOfSections; i++) {
                        const entryOffset = sectionHeadersOffset + (i * 40);
                        const virtualAddress = buffer.readUInt32LE(entryOffset + 12);
                        const virtualSize = buffer.readUInt32LE(entryOffset + 8);
                        const pointerToRawData = buffer.readUInt32LE(entryOffset + 20);

                        if (nameRva >= virtualAddress && nameRva < virtualAddress + virtualSize) {
                            nameOffset = pointerToRawData + (nameRva - virtualAddress);
                            break;
                        }
                    }

                    if (nameOffset > 0) {
                        const dllName = readString(buffer, nameOffset);
                        result.imports.push(dllName);
                        // Check for Debug runtime (ends in D.dll, e.g. MSVCR120D.dll)
                        // Strictly check for Microsoft Visual C++ Debug Runtime patterns
                        if (/MSVCR.*D\.dll$/i.test(dllName) || /MSVCP.*D\.dll$/i.test(dllName) || /VCRUNTIME.*D\.dll$/i.test(dllName)) {
                            result.debugDeps.push(dllName);
                        }
                    }
                    descriptorOffset += 20;
                }
            }
        }

    } catch (e) {
        result.error = e.message;
    }
    return result;
}

if (!fs.existsSync(libsDir)) {
    console.log("libs dir not found!");
    process.exit(1);
}

const dllFiles = fs.readdirSync(libsDir).filter(f => f.endsWith('.dll'));
console.log(`Scanning ${dllFiles.length} DLLs in ${libsDir}...\n`);

let hasError = false;

dllFiles.forEach(file => {
    const info = analyzeDll(path.join(libsDir, file));

    // Status line
    let status = `[OK]`;
    if (info.arch !== 'x64') status = `[FAIL-ARCH: ${info.arch}]`;
    if (info.debugDeps.length > 0) status = `[FAIL-DEBUG: ${info.debugDeps.join(',')}]`;
    if (info.error) status = `[ERROR: ${info.error}]`;

    if (status !== `[OK]`) hasError = true;

    console.log(`${info.file.padEnd(25)} ${status}`);
});

if (hasError) console.log("\n❌ Verification FAILED. Please fix the files marked with FAIL.");
else console.log("\n✅ Verification PASSED. All files are x64 and Release versions.");
