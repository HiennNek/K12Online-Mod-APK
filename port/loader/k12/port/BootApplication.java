package k12.port;

import android.app.Application;
import android.content.Context;

/**
 * Replaces com.pairip.application.Application, whose only job is
 * LicenseClient.checkLicense() in attachBaseContext. That check refuses to run
 * outside a Play install, so it is dropped and the gadget is loaded here
 * instead — before anything else in the process starts.
 */
public final class BootApplication extends Application {
    @Override
    protected void attachBaseContext(Context base) {
        try {
            System.loadLibrary("gadget");
        } catch (Throwable t) {
            android.util.Log.e("k12port", "gadget load failed", t);
        }
        super.attachBaseContext(base);
    }
}
