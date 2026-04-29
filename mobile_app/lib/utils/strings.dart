import 'package:flutter/foundation.dart';

class AppStrings {
  static String lang = 'en';

  static void setLang(String newLang) {
    lang = newLang;
  }

  static String get appName => 'FixoN';
  static String get version => 'v1.0.0';

  static String get profile => lang == 'te' ? 'ప్రొఫైల్' : lang == 'hi' ? 'प्रोफ़ाइल' : 'Profile';
  static String get editProfile => lang == 'te' ? 'ప్రొఫైల్ సవరించండి' : lang == 'hi' ? 'प्रोफ़ाइल संपादित करें' : 'Edit Profile';
  static String get savedAddresses => lang == 'te' ? 'సేవ్ చేసిన చిరునామాలు' : lang == 'hi' ? 'सहेजे गए पते' : 'Saved Addresses';
  static String get paymentMethods => lang == 'te' ? 'చెల్లింపు పద్ధతులు' : lang == 'hi' ? 'भुगतान के तरीके' : 'Payment Methods';
  static String get account => lang == 'te' ? 'ఖాతా' : lang == 'hi' ? 'खाता' : 'Account';
  static String get preferences => lang == 'te' ? 'ప్రాధాన్యతలు' : lang == 'hi' ? 'प्राथमिकताएं' : 'Preferences';
  static String get switchToLight => lang == 'te' ? 'లైట్ మోడ్‌కి అప్‌డేట్ చేయండి' : lang == 'hi' ? 'लाइट मोड पर जाएं' : 'Switch to Light Mode';
  static String get switchToDark => lang == 'te' ? 'డార్క్ మోడ్‌కి అప్‌డేట్ చేయండి' : lang == 'hi' ? 'डार्क मोड पर जाएं' : 'Switch to Dark Mode';
  static String get notifications => lang == 'te' ? 'నోటిఫికేషన్‌లు' : lang == 'hi' ? 'सूचनाएं' : 'Notifications';
  static String get language => lang == 'te' ? 'భాష' : lang == 'hi' ? 'भाषा' : 'Language';
  static String get support => lang == 'te' ? 'మద్దతు' : lang == 'hi' ? 'समर्थन' : 'Support';
  static String get helpFAQ => lang == 'te' ? 'సహాయం & తరచుగా అడిగే ప్రశ్నలు' : lang == 'hi' ? 'मदद और अक्सर पूछे जाने वाले प्रश्न' : 'Help & FAQ';
  static String get contactSupport => lang == 'te' ? 'మద్దతును సంప్రదించండి' : lang == 'hi' ? 'समर्थन से संपर्क करें' : 'Contact Support';
  static String get rateFixon => lang == 'te' ? 'FixoN రేట్ చేయండి' : lang == 'hi' ? 'FixoN को रेट करें' : 'Rate FixoN';
  static String get referEarn => lang == 'te' ? 'సూచించి, ₹200 సంపాదించండి' : lang == 'hi' ? 'रेफर करें और ₹200 कमाएं' : 'Refer & Earn ₹200';
  static String get logout => lang == 'te' ? 'లాగ్ అవుట్ చేయండి' : lang == 'hi' ? 'लॉग आउट' : 'Logout';
  static String get madeWithLove => lang == 'te' ? 'భారతదేశంలో 💖 తో చేయబడింది' : lang == 'hi' ? 'भारत में 💖 के साथ बनाया गया' : 'Made with 💖 in India';
}
