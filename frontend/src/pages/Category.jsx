import { useParams } from "react-router-dom";
import ProductListing from "../components/ProductListing";

export default function Category() {
  const { id } = useParams();
  return <ProductListing key={id} categoryId={id} />;
}
