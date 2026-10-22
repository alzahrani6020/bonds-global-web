const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const jobs = [
  {
    name: 'calculator feasibility report',
    script: 'generate-report.js',
    envKey: 'FEASIBILITY_PDF_OUTPUT',
    output: path.join(os.tmpdir(), `bonds-feasibility-report-${process.pid}.pdf`),
  },
  {
    name: 'food manufacturing feasibility report',
    script: 'generate-feasibility-pdf.js',
    envKey: 'FOOD_MANUFACTURING_PDF_OUTPUT',
    output: path.join(os.tmpdir(), `bonds-food-manufacturing-report-${process.pid}.pdf`),
  },
];

function verifyPdf(file, name) {
  if (!fs.existsSync(file)) throw new Error(`${name}: generator did not create a PDF`);
  const stat = fs.statSync(file);
  if (stat.size < 1024) throw new Error(`${name}: generated PDF is unexpectedly small: ${stat.size} bytes`);

  const fd = fs.openSync(file, 'r');
  const header = Buffer.alloc(5);
  fs.readSync(fd, header, 0, 5, 0);
  fs.closeSync(fd);
  if (header.toString('ascii') !== '%PDF-') throw new Error(`${name}: generated output is not a PDF`);

  console.log(`${name} generation verified: ${stat.size} bytes`);
}

try {
  for (const job of jobs) {
    const result = spawnSync(process.execPath, [path.join(__dirname, job.script)], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, [job.envKey]: job.output },
      encoding: 'utf8',
      timeout: 180000,
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.stderr.write(result.stdout || '');
      process.stderr.write(result.stderr || '');
      throw new Error(`${job.name}: generator exited with status ${result.status}`);
    }

    verifyPdf(job.output, job.name);
  }
} finally {
  for (const job of jobs) {
    if (fs.existsSync(job.output)) fs.unlinkSync(job.output);
  }
}
