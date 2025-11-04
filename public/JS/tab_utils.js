function setActiveTab(filter) {
  // Remove active class from all tabs
  const tabs = ['tabAllAppts', 'tabUpcoming', 'tabPending', 'tabPast', 'tabMissed'];
  tabs.forEach(id => {
    document.getElementById(id)?.classList.remove('tab-active');
  });
  
  // Add active class to current tab
  const tabId = `tab${filter.charAt(0).toUpperCase() + filter.slice(1)}`;
  document.getElementById(tabId === 'tabAll' ? 'tabAllAppts' : tabId)?.classList.add('tab-active');
}