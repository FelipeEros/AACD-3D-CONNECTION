const notificationMenu = document.querySelector('.notification-menu');
const notificationButton = document.querySelector('#notificationButton');
const notificationPanel = document.querySelector('#notificationPanel');
const notificationItems = [...document.querySelectorAll('.notification-item')];
const notificationList = document.querySelector('.notification-list');
const notificationBadge = document.querySelector('.notification-badge');
const markNotificationsRead = document.querySelector('#markNotificationsRead');
const notificationEmpty = document.querySelector('.notification-empty');

function updateNotificationCount() {
  const unreadCount = notificationItems.filter((item) => item.classList.contains('unread')).length;
  notificationBadge.textContent = unreadCount;
  notificationBadge.hidden = unreadCount === 0;
  markNotificationsRead.disabled = unreadCount === 0;
  notificationEmpty.classList.toggle('visible', unreadCount === 0);
  notificationList.classList.toggle('is-empty', unreadCount === 0);
}

function closeNotifications() {
  notificationPanel.classList.remove('is-open');
  notificationButton.setAttribute('aria-expanded', 'false');
}

notificationButton.addEventListener('click', (event) => {
  event.stopPropagation();
  document.querySelectorAll('.profile-dropdown.is-open').forEach((profilePanel) => {
    profilePanel.classList.remove('is-open');
    profilePanel.closest('.profile-menu')?.querySelector('.user-avatar')?.setAttribute('aria-expanded', 'false');
  });
  const isOpen = notificationPanel.classList.toggle('is-open');
  notificationButton.setAttribute('aria-expanded', String(isOpen));
});

notificationItems.forEach((item) => {
  item.addEventListener('click', () => {
    item.classList.remove('unread');
    updateNotificationCount();
  });
});

markNotificationsRead.addEventListener('click', () => {
  notificationItems.forEach((item) => item.classList.remove('unread'));
  updateNotificationCount();
});

document.addEventListener('click', (event) => {
  if (!notificationMenu.contains(event.target)) closeNotifications();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeNotifications();
});

updateNotificationCount();
