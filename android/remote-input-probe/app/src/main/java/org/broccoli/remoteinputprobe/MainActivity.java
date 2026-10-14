package org.broccoli.remoteinputprobe;

import android.app.Activity;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/** No network, account, permission or credential access. */
public final class MainActivity extends Activity {
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int margin = Math.round(24 * getResources().getDisplayMetrics().density);
        root.setPadding(margin, margin, margin, margin);

        TextView title = new TextView(this);
        title.setText("Broccoli accessibility keyboard round-trip probe");
        root.addView(title);

        EditText input = new EditText(this);
        input.setId(R.id.probe_input);
        input.setHint("Enter non-sensitive nonce only");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT);
        root.addView(input);

        Button submit = new Button(this);
        submit.setId(R.id.probe_submit);
        submit.setText("Verify input");
        root.addView(submit);

        TextView result = new TextView(this);
        result.setId(R.id.probe_result);
        result.setText("BROCCOLI_ACK:WAITING");
        result.setTextIsSelectable(true);
        root.addView(result);

        submit.setOnClickListener((View v) -> {
            String value = input.getText().toString();
            // A fixture never asks for secrets, and stores no user input on disk.
            result.setText("BROCCOLI_ACK:" + value);
        });
        setContentView(root);
        input.requestFocus();
    }
}
