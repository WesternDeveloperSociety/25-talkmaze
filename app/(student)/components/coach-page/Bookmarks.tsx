export default function Bookmarks() {
  return (
    <>
      <div
        className="max-h-[287px] p-4 hidden md:flex flex-col md:mt-23 grow
           bg-[#B1E7D6] rounded-xl"
      >
        <div className="flex justify-between">
          <h2 className="">Bookmarks</h2>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M8.57059 5.14307H15.4277C15.7308 5.14307 16.0215 5.26347 16.2359 5.4778C16.4502 5.69213 16.5706 5.98282 16.5706 6.28592V20.0002L11.9992 15.4288L7.42773 20.0002V6.28592C7.42773 5.98282 7.54814 5.69213 7.76247 5.4778C7.9768 5.26347 8.26749 5.14307 8.57059 5.14307Z"
              fill="#1F2E3B"
              stroke="#1F2E3B"
              strokeWidth="1.14286"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </>
  );
}
