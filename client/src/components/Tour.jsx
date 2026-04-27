import { useEffect, useRef } from 'react';
import * as ReactJoyrideModule from 'react-joyride';
import { useStore } from '../store/useStore';

const Joyride = ReactJoyrideModule.default || ReactJoyrideModule.Joyride || ReactJoyrideModule;
const STATUS = ReactJoyrideModule.STATUS;

export default function Tour({ run, steps, onFinish }) {
  const toursDisabled = useStore(s => s.settings.toursDisabled);
  const finishedRef   = useRef(false);

  // Mark as seen when the component unmounts, even if the user just
  // navigated away without clicking Skip/Close. This prevents the beacon
  // from reappearing on every visit.
  useEffect(() => {
    return () => {
      if (!finishedRef.current) {
        finishedRef.current = true;
        onFinish?.();
      }
    };
  // onFinish is stable (always the same arrow fn from the parent), so this is safe.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // User has disabled all tours globally — render nothing.
  if (toursDisabled) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      showProgress={false}
      showSkipButton={true}
      showCloseButton={true}
      disableOverlayClose={false}
      spotlightClicks={true}
      locale={{
        skip: 'Skip tour',
        last: 'Done',
        next: 'Next →',
        back: '← Back',
        close: 'Close',
      }}
      styles={{
        options: {
          arrowColor: '#18181b',
          backgroundColor: '#18181b',
          overlayColor: 'rgba(0, 0, 0, 0.4)',
          primaryColor: '#3b82f6',
          textColor: '#e4e4e7',
          zIndex: 1000,
        },
        beaconInner: { backgroundColor: '#60a5fa' },
        beaconOuter: {
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.2)',
        },
        tooltipContainer: {
          textAlign: 'left',
          fontSize: '14px',
          padding: '8px',
        },
        tooltipFooter: {
          marginTop: '8px',
        },
        buttonNext: {
          backgroundColor: '#fafafa',
          color: '#18181b',
          fontSize: '12px',
          fontWeight: 600,
          borderRadius: '4px',
          padding: '6px 12px',
          outline: 'none',
        },
        buttonBack: {
          color: '#a1a1aa',
          marginRight: '8px',
          fontSize: '12px',
          outline: 'none',
        },
        buttonSkip: {
          color: '#71717a',
          fontSize: '12px',
          outline: 'none',
        },
        tooltip: {
          borderRadius: '8px',
          border: '1px solid #3f3f46',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
        },
      }}
      callback={(data) => {
        const { status, action, type } = data;
        const isDone =
          [STATUS.FINISHED, STATUS.SKIPPED].includes(status) ||
          action === 'close' ||
          type === 'tour:end';

        if (isDone && !finishedRef.current) {
          finishedRef.current = true;
          onFinish?.();
        }
      }}
      tooltipComponent={TooltipWithDisable}
    />
  );
}

// Custom tooltip that renders the standard Joyride layout plus a
// "Disable all tutorials" text link in the footer.
function TooltipWithDisable({
  continuous, index, step, backProps, closeProps, primaryProps, skipProps, tooltipProps, isLastStep,
}) {
  const updateSettings = useStore(s => s.updateSettings);
  const markAllSeen    = useStore(s => s.markAllToursSeen);

  function handleDisableAll() {
    markAllSeen();
    updateSettings({ toursDisabled: true });
  }

  return (
    <div
      {...tooltipProps}
      style={{
        backgroundColor: '#18181b',
        borderRadius: '8px',
        border: '1px solid #3f3f46',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
        padding: '16px',
        maxWidth: '320px',
        color: '#e4e4e7',
        fontSize: '14px',
      }}
    >
      {step.title && (
        <div style={{ fontWeight: 600, marginBottom: '6px', color: '#fafafa' }}>
          {step.title}
        </div>
      )}
      <div style={{ lineHeight: '1.5', color: '#d4d4d8', marginBottom: '14px' }}>
        {step.content}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Skip / Back */}
        {index > 0 && (
          <button {...backProps} style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
            ← Back
          </button>
        )}
        {!isLastStep && (
          <button {...skipProps} style={{ background: 'none', border: 'none', color: '#71717a', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
            Skip
          </button>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Next / Done */}
        <button
          {...(isLastStep ? closeProps : primaryProps)}
          style={{
            backgroundColor: '#fafafa', color: '#18181b', border: 'none',
            borderRadius: '4px', padding: '6px 12px', fontSize: '12px',
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          {isLastStep ? 'Done' : 'Next →'}
        </button>
      </div>

      {/* Disable link */}
      <div style={{ marginTop: '12px', borderTop: '1px solid #3f3f46', paddingTop: '10px' }}>
        <button
          onClick={handleDisableAll}
          style={{
            background: 'none', border: 'none', color: '#52525b',
            fontSize: '11px', cursor: 'pointer', padding: 0,
          }}
          title="Turn off all in-app tutorials permanently. You can re-enable them in Settings."
        >
          Don't show tutorials
        </button>
      </div>
    </div>
  );
}
