const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const output = path.join(os.tmpdir(), `bonds-feasibility-report-${process.pid}.pdf`);

try {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'generate-report.js')], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, FEASIBILITY_PDF_OUTPUT: output },
    encoding: 'utf8',
    timeout: 180000,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error(`generator exited with status ${result.status}`);
  }

  if (!fs.existsSync(output)) throw new Error('generator did not create a PDF');
  const stat = fs.statSync(output);
  if (stat.size < 1024) throw new Error(`generated PDF is unexpectedly small: ${stat.size} bytes`);

  const fd = fs.openSync(output, 'r');
  const header = Buffer.alloc(5);
  fs.readSync(fd, header, 0, 5, 0);
  fs.closeSync(fd);
  if (header.toString('ascii') !== '%PDF-') throw new Error('generated output is not a PDF');

  console.log(`Feasibility PDF generation verified: ${stat.size} bytes`);
} finally {
  if (fs.existsSync(output)) fs.unlinkSync(output);
}
