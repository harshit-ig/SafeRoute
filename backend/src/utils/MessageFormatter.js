exports.formatEmergencyMessage = (user, lat, lng) => {
  return `
🚨 SafeRoute Emergency Alert!
User: ${user.name}
Phone: ${user.phone}

Live Location:
https://maps.google.com/?q=${lat},${lng}

Please check immediately.
  `;
};
