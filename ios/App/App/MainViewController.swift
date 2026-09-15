import UIKit
import Capacitor
import LocalAuthentication

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(BarcodeScannerNativePlugin())
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // Fallback if the storyboard window was not available at launch.
        if let window = view.window {
            OperationsAppLock.shared.install(on: window)
        }
    }
}

// Native UI gate only: does not store passwords or renew server sessions.
// Kept in this existing source file so no Xcode target changes are needed.
final class OperationsAppLock {
    static let shared = OperationsAppLock()
    private let preferenceKey = "co.the1970.operations.deviceLock.enabled.v1"
    private weak var appWindow: UIWindow?
    private var lockWindow: UIWindow?
    private var screen: OperationsLockScreen?
    private var context: LAContext?
    private var attemptID: UUID?
    private var installed = false
    private var locked = true
    private var autoUnlockPending = true
    private var offeringSetup = false
    private var enabled: Bool { UserDefaults.standard.bool(forKey: preferenceKey) }

    func install(on window: UIWindow) {
        guard !installed else { return }
        installed = true
        appWindow = window
        offeringSetup = !enabled
        locked = enabled
        showCover()
        didBecomeActive()
    }

    func willResignActive() {
        guard installed, enabled || offeringSetup else { return }
        // Cover snapshots, but don't relock for Face ID's own system prompt.
        showCover()
    }

    func didEnterBackground() {
        guard installed else { return }
        // Invalidate the identity BEFORE cancelling to reject stale callbacks.
        attemptID = nil
        context?.invalidate()
        context = nil
        if enabled {
            locked = true
            autoUnlockPending = true
        }
        if enabled || offeringSetup { showCover() }
    }

    func didBecomeActive() {
        guard installed, UIApplication.shared.applicationState == .active else { return }
        if offeringSetup {
            showCover()
        } else if enabled && locked {
            showCover()
            if autoUnlockPending && context == nil {
                autoUnlockPending = false
                authenticate(disabling: false)
            }
        } else {
            hideCover()
        }
    }

    private func showCover() {
        guard let appWindow = appWindow else { return }
        if lockWindow == nil {
            let controller = OperationsLockScreen()
            controller.onUnlock = { [weak self] in self?.authenticate(disabling: false) }
            controller.onSecondary = { [weak self] in
                guard let self = self else { return }
                if self.offeringSetup {
                    // No bypass once the user has enabled the lock.
                    self.offeringSetup = false
                    self.locked = false
                    self.hideCover()
                } else {
                    self.authenticate(disabling: true)
                }
            }
            let cover: UIWindow
            if let scene = appWindow.windowScene {
                cover = UIWindow(windowScene: scene)
            } else {
                cover = UIWindow(frame: appWindow.bounds)
            }
            cover.frame = appWindow.bounds
            cover.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.alert.rawValue + 1)
            cover.rootViewController = controller
            screen = controller
            lockWindow = cover
        }
        screen?.configure(setup: offeringSetup, busy: context != nil)
        // Separate window covers presented native screens (including scanner).
        if lockWindow?.isHidden == true {
            appWindow.endEditing(true)
            lockWindow?.makeKeyAndVisible()
        }
    }

    private func hideCover() {
        guard UIApplication.shared.applicationState == .active else { return }
        lockWindow?.isHidden = true
        appWindow?.makeKey()
    }

    private func authenticate(disabling: Bool) {
        guard context == nil, UIApplication.shared.applicationState == .active else { return }
        let auth = LAContext()
        auth.localizedCancelTitle = "Huỷ"
        var error: NSError?
        // System policy supports Face ID / Touch ID with device-passcode fallback.
        guard auth.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            screen?.showMessage("Chưa thể xác thực. Hãy kiểm tra mật mã và Face ID/Touch ID trong Cài đặt của máy, rồi thử lại.")
            return
        }
        let id = UUID()
        attemptID = id
        context = auth
        screen?.configure(setup: offeringSetup, busy: true)
        let reason = disabling
            ? "Xác thực để tắt khoá ứng dụng The 1970."
            : "Xác thực để mở The 1970 Operations."
        auth.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { [weak self] success, _ in
            DispatchQueue.main.async {
                guard let self = self, self.attemptID == id else { return }
                self.attemptID = nil
                self.context = nil
                auth.invalidate()
                guard UIApplication.shared.applicationState != .background else { return }
                if success {
                    UserDefaults.standard.set(!disabling, forKey: self.preferenceKey)
                    self.offeringSetup = false
                    self.locked = false
                    self.autoUnlockPending = false
                    self.hideCover() // If inactive, didBecomeActive removes it later.
                } else {
                    self.screen?.configure(setup: self.offeringSetup, busy: false)
                    self.screen?.showMessage("Chưa xác thực thành công. Bấm nút bên dưới để thử lại; có thể dùng mật mã của máy.")
                }
            }
        }
    }
}

private final class OperationsLockScreen: UIViewController {
    var onUnlock: (() -> Void)?
    var onSecondary: (() -> Void)?
    private let message = UILabel()
    private let unlockButton = UIButton(type: .system)
    private let secondaryButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        view.accessibilityViewIsModal = true
        let icon = UIImageView(image: UIImage(systemName: "lock.shield"))
        icon.tintColor = .label
        icon.contentMode = .scaleAspectFit
        icon.isAccessibilityElement = false
        icon.heightAnchor.constraint(equalToConstant: 64).isActive = true
        let title = UILabel()
        title.text = "THE 1970"
        title.font = .preferredFont(forTextStyle: .title1)
        title.adjustsFontForContentSizeCategory = true
        title.textAlignment = .center
        message.numberOfLines = 0
        message.font = .preferredFont(forTextStyle: .body)
        message.adjustsFontForContentSizeCategory = true
        message.textColor = .secondaryLabel
        message.textAlignment = .center
        var primary = UIButton.Configuration.filled()
        primary.baseBackgroundColor = .label
        primary.baseForegroundColor = .systemBackground
        primary.cornerStyle = .large
        primary.contentInsets = NSDirectionalEdgeInsets(top: 16, leading: 20, bottom: 16, trailing: 20)
        unlockButton.configuration = primary
        unlockButton.addTarget(self, action: #selector(unlock), for: .touchUpInside)
        secondaryButton.configuration = .plain()
        secondaryButton.addTarget(self, action: #selector(secondary), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [icon, title, message, unlockButton, secondaryButton])
        stack.axis = .vertical
        stack.spacing = 20
        let scroll = UIScrollView()
        let content = UIView()
        scroll.translatesAutoresizingMaskIntoConstraints = false
        content.translatesAutoresizingMaskIntoConstraints = false
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)
        scroll.addSubview(content)
        content.addSubview(stack)
        let preferredHeight = content.heightAnchor.constraint(equalTo: scroll.frameLayoutGuide.heightAnchor)
        preferredHeight.priority = .defaultLow
        NSLayoutConstraint.activate([
            scroll.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            scroll.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            content.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            content.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            content.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            content.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor),
            content.heightAnchor.constraint(greaterThanOrEqualTo: scroll.frameLayoutGuide.heightAnchor),
            stack.centerXAnchor.constraint(equalTo: content.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: content.centerYAnchor),
            stack.widthAnchor.constraint(equalTo: content.widthAnchor, multiplier: 0.84),
            stack.topAnchor.constraint(greaterThanOrEqualTo: content.topAnchor, constant: 24),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: content.bottomAnchor, constant: -24),
            preferredHeight
        ])
    }

    func configure(setup: Bool, busy: Bool) {
        loadViewIfNeeded()
        message.text = setup
            ? "Bật khoá ứng dụng bằng Face ID, Touch ID hoặc mật mã của máy. Khi quay lại app, bạn sẽ cần xác thực."
            : "Ứng dụng đang khoá. Xác thực bằng Face ID, Touch ID hoặc mật mã của máy để tiếp tục."
        unlockButton.configuration?.title = busy ? "Đang xác thực…" : (setup ? "Bật khoá ứng dụng" : "Mở khoá")
        unlockButton.isEnabled = !busy
        secondaryButton.configuration?.title = setup ? "Để sau" : "Tắt khoá ứng dụng…"
        secondaryButton.isEnabled = !busy
    }

    func showMessage(_ text: String) { message.text = text }
    @objc private func unlock() { onUnlock?() }
    @objc private func secondary() { onSecondary?() }
}
