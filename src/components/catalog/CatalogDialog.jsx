import Modal from "../ui/Modal.jsx";

// Book details, edit book and copies & loans all use the same navy gradient
// header as every other window in the system. The book's identity (cover,
// title, author) sits in a light panel at the top of the body instead of a
// second navy block.
export default function CatalogDialog(props) {
  return <Modal size="lg" {...props} />;
}
