export function getStoreSettings(
  billBranchId?: number | null,
  branches: any[] = [],
  activeBranchId?: number | null
) {
  const appSettingsRaw = localStorage.getItem('app_settings');
  const appSettings = appSettingsRaw ? JSON.parse(appSettingsRaw) : {};

  // 1. Try to find branch by billBranchId if provided
  let targetBranch: any = undefined;
  if (billBranchId && branches && branches.length > 0) {
    targetBranch = branches.find((b: any) => Number(b.id) === Number(billBranchId));
  }

  // 2. Fallback to activeBranchId if targetBranch is not found
  if (!targetBranch && activeBranchId && branches && branches.length > 0) {
    targetBranch = branches.find((b: any) => Number(b.id) === Number(activeBranchId));
  }

  // 3. Return resolved settings object
  return {
    storeName: targetBranch?.name || appSettings.storeName || 'SASHVIKA SAREES',
    upiId: targetBranch?.upiId || appSettings.upiId || '',
    bankAccountNumber: targetBranch?.bankAccountNumber || appSettings.bankAccountNumber || '',
    bankIfscCode: targetBranch?.bankIfscCode || appSettings.bankIfscCode || '',
    accountHolderName: targetBranch?.accountHolderName || appSettings.accountHolderName || '',
    address: targetBranch?.address || appSettings.address || '',
    phone: targetBranch?.phone || appSettings.phone || '',
    gstNumber: targetBranch?.gst || appSettings.gstNumber || '',
    showGst: targetBranch?.showGst !== undefined ? !!targetBranch.showGst : (appSettings.showGst !== undefined ? appSettings.showGst : true),
    gstInclusive: targetBranch?.gstInclusive !== undefined ? !!targetBranch.gstInclusive : (appSettings.gstInclusive || false),
    footerMessage: targetBranch?.footerMessage || appSettings.footerMessage || '',
    logoUrl: targetBranch?.logoUrl || appSettings.logoUrl || ''
  };
}
