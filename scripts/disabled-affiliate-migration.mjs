// No database import: supplements is a BFF, not an affiliate database owner.
console.error('Independent affiliate migrations are disabled. Apply reviewed migrations only in the canonical IQON Health project.');
process.exitCode = 1;
