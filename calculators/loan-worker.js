// Bonds Loan Calculator Web Worker
// Offloads amortization calculations for large loan terms

self.onmessage = function(e) {
  var inputs = e.data;
  var result = calculateLoan(inputs);
  self.postMessage(result);
};

function solvePeriodicRate(pv, pmt, n) {
  if (pv <= 0 || pmt <= 0 || n <= 0 || pmt * n <= pv) return 0;
  var low = 0, high = 5;
  for (var i = 0; i < 80; i++) {
    var mid = (low + high) / 2;
    if (mid === 0) break;
    var fmid = pmt * (1 - Math.pow(1 + mid, -n)) / mid - pv;
    // fmid > 0 means PV at mid is higher than target -> need higher rate
    if (fmid > 0) low = mid; else high = mid;
  }
  return (low + high) / 2;
}

function calculateLoan(inputs) {
  var isMonthly = inputs.frequency === 'monthly';
  var periodsPerYear = isMonthly ? 12 : 4;
  var totalPayments = isMonthly ? inputs.loanTerm : Math.floor(inputs.loanTerm / 3);
  if (totalPayments < 1) totalPayments = 1;
  var periodicRate = (inputs.interestRate / 100) / periodsPerYear;
  var interestMethod = inputs.interestMethod || 'declining';

  var adminFees = (inputs.loanAmount * (inputs.adminFeeRate || 0) / 100) + (inputs.adminFeeAmount || 0);
  var principal = inputs.loanAmount - inputs.downPayment;
  var netLoan = principal + inputs.extraFees;
  var netReceived = principal - adminFees;
  if (netReceived < 0) netReceived = 0;

  var participationRate = Math.min(Math.max(inputs.participationRate || 0, 0), 99.99);
  var totalProjectCost = participationRate >= 100 ? inputs.loanAmount : inputs.loanAmount / (1 - participationRate / 100);
  var borrowerContribution = totalProjectCost - inputs.loanAmount;

  var installment = 0, totalPaid = 0, totalInterest = 0, ear = 0;
  var schedule = [];
  var totalPrincipalPaid = 0, totalInterestPaid = 0;

  if (interestMethod === 'fixed') {
    var termYears = totalPayments / periodsPerYear;
    totalInterest = netLoan * (inputs.interestRate / 100) * termYears;
    totalPaid = netLoan + totalInterest;
    installment = totalPaid / totalPayments;
    var principalPayment = netLoan / totalPayments;
    var interestPayment = totalInterest / totalPayments;
    var balance = netLoan;
    for (var i = 1; i <= totalPayments; i++) {
      balance -= principalPayment;
      if (balance < 0) { principalPayment += balance; balance = 0; }
      totalPrincipalPaid += principalPayment;
      totalInterestPaid += interestPayment;
      schedule.push({
        period: i,
        installment: installment,
        principal: principalPayment,
        interest: interestPayment,
        balance: balance
      });
    }
    var effPeriodicRate = solvePeriodicRate(netReceived, installment, totalPayments);
    ear = Math.pow(1 + effPeriodicRate, periodsPerYear) - 1;
  } else {
    if (periodicRate === 0) {
      installment = netLoan / totalPayments;
    } else {
      installment = netLoan * (periodicRate * Math.pow(1 + periodicRate, totalPayments)) / (Math.pow(1 + periodicRate, totalPayments) - 1);
    }
    totalPaid = installment * totalPayments;
    totalInterest = totalPaid - netLoan;
    var effPeriodicRate = solvePeriodicRate(netReceived, installment, totalPayments);
    ear = Math.pow(1 + effPeriodicRate, periodsPerYear) - 1;
    var balance = netLoan;
    for (var i = 1; i <= totalPayments; i++) {
      var interestPayment = balance * periodicRate;
      var principalPayment = installment - interestPayment;
      balance -= principalPayment;
      if (balance < 0) { principalPayment += balance; balance = 0; }
      totalPrincipalPaid += principalPayment;
      totalInterestPaid += interestPayment;
      schedule.push({
        period: i,
        installment: installment,
        principal: principalPayment,
        interest: interestPayment,
        balance: balance
      });
    }
  }

  return {
    netLoan: netLoan,
    netReceived: netReceived,
    adminFees: adminFees,
    totalProjectCost: totalProjectCost,
    borrowerContribution: borrowerContribution,
    installment: installment,
    totalPaid: totalPaid,
    totalInterest: totalInterest,
    ear: ear,
    schedule: schedule,
    totalPayments: totalPayments,
    totalPrincipalPaid: totalPrincipalPaid,
    totalInterestPaid: totalInterestPaid,
    periodicRate: periodicRate,
    periodsPerYear: periodsPerYear,
    interestMethod: interestMethod
  };
}
