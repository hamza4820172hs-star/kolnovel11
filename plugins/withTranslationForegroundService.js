const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withTranslationForegroundService(config) {
  config = withAndroidManifest(config, config => {
    const manifest = config.modResults.manifest;
    const permissions = manifest['uses-permission'] || [];
    const addPermission = name => {
      if (!permissions.some(p => p.$?.['android:name'] === name)) {
        permissions.push({ $: { 'android:name': name } });
      }
    };
    addPermission('android.permission.FOREGROUND_SERVICE');
    addPermission('android.permission.WAKE_LOCK');
    addPermission('android.permission.FOREGROUND_SERVICE_DATA_SYNC');
    addPermission('android.permission.POST_NOTIFICATIONS');
    manifest['uses-permission'] = permissions;

    const app = manifest.application?.[0];
    if (app) {
      app.service = app.service || [];
      const serviceName = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';
      let service = app.service.find(s => s.$?.['android:name'] === serviceName);
      if (!service) {
        service = { $: { 'android:name': serviceName } };
        app.service.push(service);
      }
      service.$['android:foregroundServiceType'] = 'dataSync';
      service.$['android:exported'] = 'false';
    }
    return config;
  });

  // Android 14+ rejects the library's implicit notification PendingIntent.
  // Make the notification tap intent explicit by restricting it to this app.
  config = withDangerousMod(config, ['android', async config => {
    const javaFile = path.join(
      config.modRequest.projectRoot,
      'node_modules/react-native-background-actions/android/src/main/java/com/asterinet/react/bgactions/RNBackgroundActionsTask.java'
    );
    if (!fs.existsSync(javaFile)) {
      throw new Error('Could not find RNBackgroundActionsTask.java to apply Android 14+ PendingIntent fix.');
    }
    let source = fs.readFileSync(javaFile, 'utf8');
    if (!source.includes('notificationIntent.setPackage(context.getPackageName());')) {
      const marker = '            final PendingIntent contentIntent;';
      if (!source.includes(marker)) {
        throw new Error('Could not locate notification PendingIntent code; background-actions patch was not applied.');
      }
      source = source.replace(marker,
        '            // Make the launcher/deep-link intent explicit for Android 14+ security rules.\\n' +
        '            notificationIntent.setPackage(context.getPackageName());\\n' +
        marker
      );
      fs.writeFileSync(javaFile, source, 'utf8');
    }
    return config;
  }]);
  return config;
};
