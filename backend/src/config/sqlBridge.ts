import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export type SqlRow = Record<string, string | number | boolean | null>;

export interface QueryResult {
    rows: SqlRow[];
    error: string | null;
}

const SCRIPT_PATH = path.join(
    process.env.LOCALAPPDATA || 'C:\\Users\\Craig\\AppData\\Local',
    'hermes', 'scripts', 'sql_bridge.ps1'
);

export function query(sql: string): QueryResult {
    const tmpFile = path.join(os.tmpdir(), `nova_query_${Date.now()}.sql`);

    try {
        fs.writeFileSync(tmpFile, sql, 'utf8');

        // Pass file path — no $ symbols = no bash substitution issues
        const cmd = `powershell.exe -ExecutionPolicy Bypass -File "${SCRIPT_PATH}" -file "${tmpFile}"`;
        const output = execSync(cmd, { timeout: 30000, encoding: 'utf8' }).trim();

        if (output.startsWith('SQL_OK:')) {
            const json = output.slice(7);
            return { rows: JSON.parse(json), error: null };
        }

        if (output.startsWith('SQL_ERROR:')) {
            return { rows: [], error: output.slice(10) };
        }

        return { rows: [], error: `Unexpected bridge output: ${output.slice(0, 300)}` };
    } catch (err: any) {
        // execSync throws on non-zero exit — capture stderr
        let detail = '';
        if (err.stderr) detail = err.stderr.toString().trim();
        else if (err.stdout) detail = err.stdout.toString().trim();
        else detail = err.message || 'Unknown error';
        return { rows: [], error: `${detail} (exit: ${err.status ?? '?'})` };
    } finally {
        try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
}

export function queryFirst(sql: string): SqlRow | null {
    const result = query(sql);
    if (result.error) throw new Error(result.error);
    return result.rows.length > 0 ? result.rows[0] : null;
}

export function queryRequired(sql: string): SqlRow[] {
    const result = query(sql);
    if (result.error) throw new Error(result.error);
    return result.rows;
}