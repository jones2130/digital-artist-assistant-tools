{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs_24
    pkgs.git
    pkgs.stripe-cli
  ];
}
