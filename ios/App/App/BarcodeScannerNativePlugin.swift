import Foundation
import Capacitor
import AVFoundation
import UIKit

@objc(BarcodeScannerNativePlugin)
public class BarcodeScannerNativePlugin: CAPPlugin {
    private var activeCall: CAPPluginCall?
    private var scannerViewController: BarcodeScannerNativeViewController?

    @objc func scan(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard self.activeCall == nil else {
                call.reject("Máy quét đang mở.")
                return
            }

            let status = AVCaptureDevice.authorizationStatus(for: .video)
            switch status {
            case .authorized:
                self.presentScanner(call)
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    DispatchQueue.main.async {
                        if granted {
                            self.presentScanner(call)
                        } else {
                            call.reject("Chưa cấp quyền camera.")
                        }
                    }
                }
            case .denied, .restricted:
                call.reject("Chưa cấp quyền camera. Vào Cài đặt iPhone > The 1970 > bật Camera.")
            @unknown default:
                call.reject("Không kiểm tra được quyền camera.")
            }
        }
    }

    private func presentScanner(_ call: CAPPluginCall) {
        guard let presentingViewController = self.bridge?.viewController else {
            call.reject("Không tìm thấy màn hình app để mở camera.")
            return
        }

        self.activeCall = call
        let scanner = BarcodeScannerNativeViewController()
        scanner.modalPresentationStyle = .fullScreen
        scanner.onResult = { [weak self] value in
            guard let self = self else { return }
            self.scannerViewController?.dismiss(animated: true) {
                self.activeCall?.resolve(["value": value])
                self.activeCall = nil
                self.scannerViewController = nil
            }
        }
        scanner.onCancel = { [weak self] in
            guard let self = self else { return }
            self.scannerViewController?.dismiss(animated: true) {
                self.activeCall?.resolve(["cancelled": true])
                self.activeCall = nil
                self.scannerViewController = nil
            }
        }
        scanner.onError = { [weak self] message in
            guard let self = self else { return }
            self.scannerViewController?.dismiss(animated: true) {
                self.activeCall?.reject(message)
                self.activeCall = nil
                self.scannerViewController = nil
            }
        }

        self.scannerViewController = scanner
        presentingViewController.present(scanner, animated: true)
    }
}

final class BarcodeScannerNativeViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onResult: ((String) -> Void)?
    var onCancel: (() -> Void)?
    var onError: ((String) -> Void)?

    private let session = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var didReturnResult = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupCamera()
        setupOverlay()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        if !session.isRunning {
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                self?.session.startRunning()
            }
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if session.isRunning {
            session.stopRunning()
        }
    }

    private func setupCamera() {
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            onError?("Không tìm thấy camera sau.")
            return
        }

        do {
            let input = try AVCaptureDeviceInput(device: device)
            if session.canAddInput(input) { session.addInput(input) }

            let output = AVCaptureMetadataOutput()
            if session.canAddOutput(output) {
                session.addOutput(output)
                output.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
                output.metadataObjectTypes = [
                    .code128,
                    .code39,
                    .code93,
                    .ean13,
                    .ean8,
                    .upce,
                    .qr,
                    .pdf417,
                    .aztec,
                    .dataMatrix,
                    .interleaved2of5,
                    .itf14
                ]
            }

            let preview = AVCaptureVideoPreviewLayer(session: session)
            preview.videoGravity = .resizeAspectFill
            preview.frame = view.bounds
            view.layer.insertSublayer(preview, at: 0)
            previewLayer = preview
        } catch {
            onError?("Không mở được camera: \(error.localizedDescription)")
        }
    }

    private func setupOverlay() {
        let title = UILabel()
        title.translatesAutoresizingMaskIntoConstraints = false
        title.text = "Đưa mã vạch vào khung"
        title.textColor = .white
        title.font = .systemFont(ofSize: 18, weight: .bold)
        title.textAlignment = .center
        view.addSubview(title)

        let hint = UILabel()
        hint.translatesAutoresizingMaskIntoConstraints = false
        hint.text = "Hỗ trợ Code128, EAN, QR và các mã phổ biến"
        hint.textColor = UIColor.white.withAlphaComponent(0.75)
        hint.font = .systemFont(ofSize: 13, weight: .semibold)
        hint.textAlignment = .center
        hint.numberOfLines = 2
        view.addSubview(hint)

        let frameView = UIView()
        frameView.translatesAutoresizingMaskIntoConstraints = false
        frameView.layer.borderColor = UIColor.white.cgColor
        frameView.layer.borderWidth = 3
        frameView.layer.cornerRadius = 18
        frameView.backgroundColor = UIColor.clear
        view.addSubview(frameView)

        let cancelButton = UIButton(type: .system)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        cancelButton.setTitle("Đóng", for: .normal)
        cancelButton.setTitleColor(.white, for: .normal)
        cancelButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .bold)
        cancelButton.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        cancelButton.layer.cornerRadius = 22
        cancelButton.contentEdgeInsets = UIEdgeInsets(top: 10, left: 20, bottom: 10, right: 20)
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        view.addSubview(cancelButton)

        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
            title.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            title.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),

            hint.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 8),
            hint.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 28),
            hint.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -28),

            frameView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            frameView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            frameView.widthAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.78),
            frameView.heightAnchor.constraint(equalToConstant: 170),

            cancelButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -28),
            cancelButton.centerXAnchor.constraint(equalTo: view.centerXAnchor)
        ])
    }

    @objc private func cancelTapped() {
        onCancel?()
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard !didReturnResult else { return }
        guard let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject else { return }
        guard let value = object.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return }

        didReturnResult = true
        session.stopRunning()
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        onResult?(value)
    }
}
