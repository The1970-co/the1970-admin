#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(BarcodeScannerNativePlugin, "BarcodeScannerNative",
  CAP_PLUGIN_METHOD(scan, CAPPluginReturnPromise);
)
